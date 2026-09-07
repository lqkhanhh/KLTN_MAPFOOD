import { useState } from 'react';
import type { PaymentMethod } from '../types/checkout';

export function usePaymentMethod() {
  return useState<PaymentMethod>('cash');
}

interface Props {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({ value, onChange, disabled = false }: Props) {
  return <fieldset><legend>Phương thức thanh toán</legend>
    <label><input name="payment-method" type="radio" value="cash" disabled={disabled}
      checked={value === 'cash'} onChange={() => onChange('cash')} /> Tiền mặt khi ghé lấy</label>
    <label><input name="payment-method" type="radio" value="vnpay" disabled={disabled}
      checked={value === 'vnpay'} onChange={() => onChange('vnpay')} /> Cổng VNPAY (QR / Thẻ ATM / Visa)</label>
  </fieldset>;
}
