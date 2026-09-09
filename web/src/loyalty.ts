import { useEffect, useState } from 'react';
import { request } from './api';
import { useAuth } from './contexts/AuthContext';

export interface Voucher { id: string; code: string; title: string; discountType: 'fixed' | 'percent'; discountValue: number; minOrderAmount: number; pointsCost: number | null; active: boolean; }
export interface OwnedVoucher { id: string; voucherId: string; voucher: Voucher; usedInOrderId: string | null; publicClaim: boolean; obtainedAt: string; }
export const money = (value: number) => `${Number(value).toLocaleString('vi-VN')}đ`;
export function discountFor(voucher: Voucher | undefined, subtotal: number) {
  if (!voucher?.active || subtotal < voucher.minOrderAmount) return 0;
  return Math.min(subtotal, voucher.discountType === 'fixed' ? voucher.discountValue
    : Number((BigInt(Math.round(subtotal)) * BigInt(voucher.discountValue) + BigInt(50)) / BigInt(100)));
}
export function voucherTerms(v: Voucher) { return `Giảm ${v.discountType === 'percent' ? v.discountValue + '%' : money(v.discountValue)} · Đơn từ ${money(v.minOrderAmount)}`; }

export function useCheckoutVouchers(subtotal: number, restaurantId: string) {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<OwnedVoucher[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setRows([]); setError(''); setSelectedId('');
    if (currentUser?.role !== 'customer') { setLoading(false); return; }
    setLoading(true);
    request('/vouchers/my-vouchers').then((data: OwnedVoucher[]) => { if (alive) setRows(data); })
      .catch(() => { if (alive) setError('Chưa tải được voucher. Bạn có thể thử lại hoặc đặt hàng không dùng voucher.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [currentUser?.id, currentUser?.role, restaurantId, revision]);
  const available = rows.filter((row) => !row.usedInOrderId && row.voucher.active);
  const selected = available.find((row) => row.id === selectedId && subtotal >= row.voucher.minOrderAmount);
  // Khi giảm số món khiến đơn không đủ điều kiện, không gửi voucher không hợp lệ.
  useEffect(() => { if (!selected) setSelectedId(''); }, [selected?.id]);
  return { available, selected, selectedId: selected?.id || '', setSelectedId, discount: discountFor(selected?.voucher, subtotal),
    error, loading, enabled: currentUser?.role === 'customer', retry: () => setRevision((n) => n + 1) };
}
