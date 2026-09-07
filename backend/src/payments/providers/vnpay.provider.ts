import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentProvider, PaymentStatus } from '../../database/entities';
import {
  CreateProviderPaymentRequest,
  CreateProviderPaymentResult,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
} from './payment-provider.interface';

type VnpayPayload = Record<string, string | undefined>;

/** VNPAY sandbox adapter. Mọi callback đều được kiểm tra HMAC SHA512. */
export class VnpayProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.VNPAY;

  constructor(private readonly config: ConfigService) {}

  validateConfiguration() {
    for (const key of ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL']) {
      if (!this.config.get<string>(key)?.trim()) {
        throw new ServiceUnavailableException(`Chưa cấu hình ${key}. Vui lòng cấu hình tài khoản VNPAY sandbox trước khi thanh toán.`);
      }
    }
    if (!/^[a-zA-Z0-9]{8}$/.test(this.config.getOrThrow<string>('VNPAY_TMN_CODE'))) {
      throw new ServiceUnavailableException('VNPAY_TMN_CODE phải gồm 8 ký tự chữ hoặc số do VNPAY cấp.');
    }
    const secret = this.config.getOrThrow<string>('VNPAY_HASH_SECRET');
    if (secret !== secret.trim()) throw new ServiceUnavailableException('VNPAY_HASH_SECRET có khoảng trắng thừa.');
    for (const key of ['VNPAY_RETURN_URL', 'VNPAY_URL']) {
      const value = this.config.get<string>(key) ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || value !== value.trim() || value.length > 255) throw new Error();
      } catch { throw new ServiceUnavailableException(`${key} không phải URL HTTP/HTTPS hợp lệ.`); }
    }
  }

  canReuseCheckout(checkoutUrl: string) {
    // Không gửi khách lại liên kết cũ thiếu trường hoặc ký bằng cấu hình cũ.
    try {
      const url = new URL(checkoutUrl);
      const params = Object.fromEntries(url.searchParams);
      const signature = params.vnp_SecureHash;
      delete params.vnp_SecureHash;
      return params.vnp_TmnCode === this.config.get<string>('VNPAY_TMN_CODE') &&
        /^\d{14}$/.test(params.vnp_ExpireDate || '') &&
        params.vnp_ExpireDate > this.formatDate(new Date()) &&
        signature === createHmac('sha512', this.config.getOrThrow<string>('VNPAY_HASH_SECRET'))
          .update(this.canonical(params), 'utf8').digest('hex');
    } catch { return false; }
  }

  async createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult> {
    this.validateConfiguration();
    const now = new Date();
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || request.amount * 100 > 999999999999) {
      throw new BadRequestException('Số tiền VNPAY phải là số nguyên VND dương, tối đa 9.999.999.999đ.');
    }
    if (!Number.isFinite(request.expiresAt.getTime()) || request.expiresAt <= now) {
      throw new BadRequestException('Thời hạn thanh toán VNPAY không hợp lệ.');
    }
    if (!/^[a-zA-Z0-9]{1,100}$/.test(request.transactionId)) throw new BadRequestException('Mã giao dịch VNPAY không hợp lệ.');
    const orderInfo = `Thanh toan don ${request.orderCode.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 255);
    const params: Record<string, string> = {
      vnp_Amount: String(request.amount * 100),
      vnp_Command: 'pay',
      vnp_CreateDate: this.formatDate(now),
      vnp_ExpireDate: this.formatDate(request.expiresAt),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: this.config.getOrThrow<string>('VNPAY_RETURN_URL'),
      vnp_TmnCode: this.config.getOrThrow<string>('VNPAY_TMN_CODE'),
      vnp_TxnRef: request.transactionId,
      vnp_Version: '2.1.0',
    };
    const query = this.sign(params);
    return {
      checkoutUrl: `${this.config.get<string>('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')}?${query}`,
      expiresAt: request.expiresAt,
      safePayload: { orderCode: request.orderCode, orderInfo, transactionId: request.transactionId },
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook> {
    this.validateConfiguration();
    if (!payload || typeof payload !== 'object') throw new BadRequestException('Dữ liệu VNPAY không hợp lệ');
    const value = Object.fromEntries(Object.entries(payload as VnpayPayload).filter(([, item]) => typeof item === 'string')) as Record<string, string>;
    const received = value.vnp_SecureHash;
    if (!received) throw new BadRequestException('Thiếu chữ ký VNPAY');
    const unsigned = { ...value };
    delete unsigned.vnp_SecureHash;
    delete unsigned.vnp_SecureHashType;
    const expected = createHmac('sha512', this.config.getOrThrow<string>('VNPAY_HASH_SECRET'))
      .update(this.canonical(unsigned), 'utf8').digest('hex');
    const actualBuffer = Buffer.from(received, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new BadRequestException('Chữ ký VNPAY không hợp lệ');
    }
    if (value.vnp_TmnCode !== this.config.get<string>('VNPAY_TMN_CODE')) throw new BadRequestException('Mã website VNPAY không khớp');
    const amount = Number(value.vnp_Amount) / 100;
    if (!value.vnp_TxnRef || !Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Dữ liệu giao dịch VNPAY không hợp lệ');
    }
    return {
      transactionId: value.vnp_TxnRef,
      amount,
      status: value.vnp_ResponseCode === '00' && value.vnp_TransactionStatus === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED,
      reference: value.vnp_TransactionNo,
      safePayload: { orderCode: value.vnp_OrderInfo, responseCode: value.vnp_ResponseCode, transactionNo: value.vnp_TransactionNo },
    };
  }

  private sign(params: Record<string, string>) {
    const canonical = this.canonical(params);
    const secureHash = createHmac('sha512', this.config.getOrThrow<string>('VNPAY_HASH_SECRET')).update(canonical, 'utf8').digest('hex');
    return `${canonical}&vnp_SecureHash=${secureHash}`;
  }

  private canonical(params: Record<string, string>) {
    return Object.keys(params).sort().map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`).join('&');
  }

  private formatDate(value: Date) {
    // VNPAY yêu cầu GMT+7, không phụ thuộc múi giờ của máy chạy backend.
    const vietnam = new Date(value.getTime() + 7 * 60 * 60 * 1000);
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${vietnam.getUTCFullYear()}${pad(vietnam.getUTCMonth() + 1)}${pad(vietnam.getUTCDate())}${pad(vietnam.getUTCHours())}${pad(vietnam.getUTCMinutes())}${pad(vietnam.getUTCSeconds())}`;
  }
}
