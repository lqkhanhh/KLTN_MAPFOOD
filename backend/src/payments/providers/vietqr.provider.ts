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

interface VietQrWebhookPayload {
  transactionId: string;
  orderCode: string;
  amount: number;
  status: string;
  reference?: string;
  signature: string;
}

export class VietQrProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.VIETQR;

  constructor(private readonly config: ConfigService) {}

  async createPayment(
    request: CreateProviderPaymentRequest,
  ): Promise<CreateProviderPaymentResult> {
    const bin = this.config.getOrThrow<string>('VIETQR_BANK_BIN');
    const account = this.config.getOrThrow<string>('VIETQR_ACCOUNT_NUMBER');
    const accountName = this.config.getOrThrow<string>('VIETQR_ACCOUNT_NAME');
    const query = new URLSearchParams({
      amount: String(request.amount),
      addInfo: request.transactionId,
      accountName,
    });
    return {
      qrCode: `https://img.vietqr.io/image/${bin}-${account}-compact2.png?${query}`,
      expiresAt: request.expiresAt,
      safePayload: { mode: 'LOCAL_VIETQR', bankBin: bin, expiresAt: request.expiresAt.toISOString() },
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook> {
    if (!this.isWebhookPayload(payload)) {
      throw new BadRequestException('Webhook VietQR local không đúng định dạng');
    }
    const secret = this.config.getOrThrow<string>('PAYMENTS_DEMO_WEBHOOK_SECRET');
    const canonical = [
      payload.transactionId,
      payload.orderCode,
      payload.amount,
      payload.status.toUpperCase(),
    ].join('|');
    const expected = createHmac('sha256', secret).update(canonical).digest('hex');
    const receivedBuffer = Buffer.from(payload.signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Chữ ký webhook VietQR local không hợp lệ');
    }
    return {
      transactionId: payload.transactionId,
      amount: payload.amount,
      status: this.mapStatus(payload.status),
      reference: payload.reference,
      safePayload: {
        orderCode: payload.orderCode,
        status: payload.status.toUpperCase(),
        reference: payload.reference,
      },
    };
  }

  private mapStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!Object.values(PaymentStatus).includes(normalized as PaymentStatus)) {
      throw new BadRequestException('Trạng thái webhook VietQR local không hợp lệ');
    }
    return normalized as PaymentStatus;
  }

  private isWebhookPayload(payload: unknown): payload is VietQrWebhookPayload {
    if (!payload || typeof payload !== 'object') return false;
    const value = payload as Record<string, unknown>;
    return (
      typeof value.transactionId === 'string' &&
      typeof value.orderCode === 'string' &&
      typeof value.amount === 'number' &&
      typeof value.status === 'string' &&
      typeof value.signature === 'string'
    );
  }
}
