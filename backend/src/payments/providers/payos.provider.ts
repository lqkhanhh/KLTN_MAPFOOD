import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, Webhook } from '@payos/node';
import { PaymentProvider, PaymentStatus } from '../../database/entities';
import {
  CreateProviderPaymentRequest,
  CreateProviderPaymentResult,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
} from './payment-provider.interface';

export class PayOSProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.PAYOS;
  private readonly client: PayOS;

  constructor(private readonly config: ConfigService) {
    this.client = new PayOS({
      clientId: config.getOrThrow<string>('PAYOS_CLIENT_ID'),
      apiKey: config.getOrThrow<string>('PAYOS_API_KEY'),
      checksumKey: config.getOrThrow<string>('PAYOS_CHECKSUM_KEY'),
    });
  }

  async createPayment(
    request: CreateProviderPaymentRequest,
  ): Promise<CreateProviderPaymentResult> {
    const result = await this.client.paymentRequests.create({
      orderCode: Number(request.transactionId),
      amount: request.amount,
      description: `RouteBite ${request.orderCode.slice(-12)}`,
      items: request.items,
      returnUrl: this.config.getOrThrow<string>('PAYOS_RETURN_URL'),
      cancelUrl: this.config.getOrThrow<string>('PAYOS_CANCEL_URL'),
      expiredAt: Math.floor(request.expiresAt.getTime() / 1000),
    });
    return {
      paymentLinkId: result.paymentLinkId,
      checkoutUrl: result.checkoutUrl,
      qrCode: result.qrCode,
      expiresAt: result.expiredAt ? new Date(result.expiredAt * 1000) : request.expiresAt,
      safePayload: {
        currency: result.currency,
        status: result.status,
        description: result.description,
        expiredAt: result.expiredAt,
      },
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook> {
    try {
      const verified = await this.client.webhooks.verify(payload as Webhook);
      return {
        transactionId: String(verified.orderCode),
        paymentLinkId: verified.paymentLinkId,
        amount: Number(verified.amount),
        status: verified.code === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED,
        reference: verified.reference,
        safePayload: {
          code: verified.code,
          currency: verified.currency,
          reference: verified.reference,
          transactionDateTime: verified.transactionDateTime,
        },
      };
    } catch {
      throw new BadRequestException('Chữ ký webhook PayOS không hợp lệ');
    }
  }
}
