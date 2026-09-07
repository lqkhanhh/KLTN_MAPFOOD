import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider } from '../../database/entities';
import { UnavailablePaymentProvider } from './unavailable.provider';
import { PaymentsService } from '../payments.service';
import { UserRole } from '../../database/entities';

describe('Cổng thanh toán chưa triển khai', () => {
  it('khởi tạo adapter nhưng không tạo giao dịch hoặc xác nhận callback', async () => {
    const provider = new UnavailablePaymentProvider(PaymentProvider.VIETQR);
    expect(provider.provider).toBe(PaymentProvider.VIETQR);
    expect(() => provider.validateConfiguration()).toThrow(ServiceUnavailableException);
    await expect(provider.createPayment()).rejects.toThrow(ServiceUnavailableException);
    await expect(provider.verifyWebhook()).rejects.toThrow(ServiceUnavailableException);
  });
  it('từ chối trước khi ghi dữ liệu thanh toán', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new PaymentsService(dataSource as never,
      { findEntityForUser: jest.fn().mockResolvedValue({ userId: 'customer' }) } as never,
      {} as never, new UnavailablePaymentProvider(PaymentProvider.VIETQR), {} as never);
    await expect(service.create('order', { sub: 'customer', email: 'test@example.invalid', role: UserRole.CUSTOMER })).rejects.toThrow(ServiceUnavailableException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
