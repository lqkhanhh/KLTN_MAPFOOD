import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentStatus } from '../../database/entities';
import { VietQrProvider } from './vietqr.provider';

describe('VietQrProvider webhook signature', () => {
  const secret = 'local-test-secret';
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        PAYMENTS_DEMO_WEBHOOK_SECRET: secret,
        VIETQR_BANK_BIN: '970422',
        VIETQR_ACCOUNT_NUMBER: '0000000000',
        VIETQR_ACCOUNT_NAME: 'ROUTEBITE',
      };
      return values[key];
    }),
  } as unknown as ConfigService;
  const provider = new VietQrProvider(config);
  const basePayload = {
    transactionId: '1788026400000001',
    orderCode: 'ORD-20260830-ABC123',
    amount: 100_000,
    status: 'PAID',
  };

  it('rejects an invalid HMAC', async () => {
    await expect(
      provider.verifyWebhook({ ...basePayload, signature: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a canonical HMAC and normalizes status', async () => {
    const canonical = [
      basePayload.transactionId,
      basePayload.orderCode,
      basePayload.amount,
      basePayload.status,
    ].join('|');
    const signature = createHmac('sha256', secret).update(canonical).digest('hex');

    await expect(
      provider.verifyWebhook({ ...basePayload, signature }),
    ).resolves.toMatchObject({
      transactionId: basePayload.transactionId,
      amount: basePayload.amount,
      status: PaymentStatus.PAID,
    });
  });
});
