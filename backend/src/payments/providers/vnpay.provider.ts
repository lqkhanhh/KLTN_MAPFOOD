import { BadRequestException } from '@nestjs/common';
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

  async createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult> {
    const now = new Date();
    const params: Record<string, string> = {
      vnp_Amount: String(request.amount * 100),
      vnp_Command: 'pay',
      vnp_CreateDate: this.formatDate(now),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: request.orderCode,
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
      safePayload: { orderCode: request.orderCode, transactionId: request.transactionId },
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook> {
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
    const amount = Number(value.vnp_Amount) / 100;
    if (!value.vnp_TxnRef || !Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Dữ liệu giao dịch VNPAY không hợp lệ');
    }
    return {
      transactionId: value.vnp_TxnRef,
      amount,
      status: value.vnp_ResponseCode === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED,
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
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
  }
}
