export type PaymentMethod = 'cash' | 'vnpay';

export interface CreateOrderPayload {
  restaurantId: string;
  userVoucherId?: string;
  pickupOption:
    | { type: 'asap'; estimatedPickupMinutes: number }
    | { type: 'scheduled'; scheduledTime: string };
  payment: { method: PaymentMethod };
  items: { menuItemId: string; quantity: number; note?: string }[];
  note?: string;
}

// Chặn giá trị ngoài danh sách ngay cả khi lời gọi đến từ component JSX.
export function validateOrderPayload(payload: CreateOrderPayload): CreateOrderPayload {
  if (!['cash', 'vnpay'].includes(payload.payment.method)) {
    throw new Error('Vui lòng chọn Tiền mặt hoặc VNPAY.');
  }
  return payload;
}
