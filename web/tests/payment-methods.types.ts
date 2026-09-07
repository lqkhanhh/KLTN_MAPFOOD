import type { CreateOrderPayload, PaymentMethod } from '../src/types/checkout';

const cash: PaymentMethod = 'cash';
const online: PaymentMethod = 'vnpay';
const payment: CreateOrderPayload['payment'] = { method: online };
// @ts-expect-error Phương thức ngoài danh sách phải bị từ chối khi kiểm tra kiểu.
const unsupported: PaymentMethod = 'unsupported';
// @ts-expect-error Payload không chấp nhận chuỗi tự do.
const invalidPayload: CreateOrderPayload['payment'] = { method: 'bank-transfer' };
void [cash, payment, unsupported, invalidPayload];
