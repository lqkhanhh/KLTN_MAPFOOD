import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentStatus } from '../../database/entities';
import { VnpayProvider } from './vnpay.provider';

const settings = {
  VNPAY_TMN_CODE: 'TEST1234', VNPAY_HASH_SECRET: 'test-only-secret',
  VNPAY_RETURN_URL: 'http://127.0.0.1:3000/api/payments/vnpay-return',
};
const canonical = (params: Record<string, string>) => Object.keys(params).sort()
  .map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`).join('&');
const signed = (params: Record<string, string>) => ({ ...params,
  vnp_SecureHash: createHmac('sha512', settings.VNPAY_HASH_SECRET).update(canonical(params)).digest('hex'),
});

describe('VNPAY định dạng URL và xác thực thanh toán', () => {
  const provider = new VnpayProvider(new ConfigService(settings));
  const request = { transactionId: '1788696000123', orderCode: 'ORD-20260906-001', amount: 60000, items: [], expiresAt: new Date('2026-09-06T17:04:00Z') };
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-06T16:59:00Z')); });
  afterEach(() => jest.useRealTimers());

  it('gửi đủ trường, số tiền nhân 100, GMT+7 qua ngày và HMAC SHA512', async () => {
    const result = await provider.createPayment(request);
    const params = new URL(result.checkoutUrl!).searchParams;
    expect(params.get('vnp_Amount')).toBe('6000000');
    expect(params.get('vnp_CreateDate')).toBe('20260906235900');
    expect(params.get('vnp_ExpireDate')).toBe('20260907000400');
    expect(params.get('vnp_ReturnUrl')).toBe(settings.VNPAY_RETURN_URL);
    expect(params.get('vnp_OrderInfo')).toBe('Thanh toan don ORD20260906001');
    const hash = params.get('vnp_SecureHash'); params.delete('vnp_SecureHash');
    expect(hash).toBe(signed(Object.fromEntries(params)).vnp_SecureHash);
    expect(provider.canReuseCheckout(result.checkoutUrl!)).toBe(true);
    const old = new URL(result.checkoutUrl!); old.searchParams.delete('vnp_ExpireDate');
    expect(provider.canReuseCheckout(old.toString())).toBe(false);
    jest.setSystemTime(request.expiresAt);
    expect(provider.canReuseCheckout(result.checkoutUrl!)).toBe(false);
  });

  it.each(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL'])('không tạo URL khi thiếu %s', async (key) => {
    const missing = new VnpayProvider(new ConfigService({ ...settings, [key]: '' }));
    await expect(missing.createPayment(request)).rejects.toThrow(key);
    await expect(missing.verifyWebhook({})).rejects.toThrow(key);
  });

  it.each([0, -1, 1.5, 10000000000, NaN])('chặn số tiền không hợp lệ: %s', async (amount) => {
    await expect(provider.createPayment({ ...request, amount })).rejects.toThrow('Số tiền');
  });

  it('chặn mã website sai và thời gian hết hạn', async () => {
    const invalid = new VnpayProvider(new ConfigService({ ...settings, VNPAY_TMN_CODE: 'sample' }));
    await expect(invalid.createPayment(request)).rejects.toThrow('8 ký tự');
    await expect(provider.createPayment({ ...request, expiresAt: new Date('invalid') })).rejects.toThrow('Thời hạn');
  });

  it('chỉ ghi nhận thành công khi cả hai trạng thái bằng 00 và chữ ký đúng', async () => {
    const callback = { vnp_TmnCode: settings.VNPAY_TMN_CODE, vnp_TxnRef: request.transactionId,
      vnp_Amount: '6000000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_OrderInfo: 'Thanh toan don ORD20260906001' };
    expect((await provider.verifyWebhook(signed(callback))).status).toBe(PaymentStatus.PAID);
    expect((await provider.verifyWebhook(signed({ ...callback, vnp_TransactionStatus: '02' }))).status).toBe(PaymentStatus.FAILED);
    await expect(provider.verifyWebhook({ ...signed(callback), vnp_Amount: '100' })).rejects.toThrow('Chữ ký');
    await expect(provider.verifyWebhook(signed({ ...callback, vnp_TmnCode: 'OTHER123' }))).rejects.toThrow('website');
  });
});
