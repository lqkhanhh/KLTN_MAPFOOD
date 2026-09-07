import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider } from '../../database/entities';
import { PaymentProviderAdapter } from './payment-provider.interface';

/** Chặn riêng thanh toán chưa được triển khai, không chặn các module độc lập. */
export class UnavailablePaymentProvider implements PaymentProviderAdapter {
  constructor(readonly provider: PaymentProvider) {}

  validateConfiguration(): never {
    throw new ServiceUnavailableException(
      `Thanh toán ${this.provider} chưa được hỗ trợ trong bản backend này. Vui lòng chọn tiền mặt hoặc cấu hình VNPAY.`,
    );
  }

  async createPayment(): Promise<never> { return this.validateConfiguration(); }
  async verifyWebhook(): Promise<never> { return this.validateConfiguration(); }
}
