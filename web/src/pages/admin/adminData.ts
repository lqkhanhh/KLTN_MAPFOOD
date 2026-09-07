import { useCallback, useEffect, useState } from 'react';
import { request } from '../../api';

export type UserRole = 'customer' | 'merchant' | 'admin';
export const ROLE_LABELS: Record<UserRole, string> = { customer: 'Khách hàng', merchant: 'Chủ quán', admin: 'Quản trị viên' };
export interface OverviewData {
  usersByRole: { role: UserRole; count: number }[];
  totalRestaurants: number; totalOrders: number; gmv: number; newUsersThisMonth: number;
  topRestaurants: { id: string; name: string; orderCount: number }[];
}
export interface SearchStats {
  totalSearches: number;
  popularOriginAreas: { latitude: number; longitude: number; count: number }[];
  note?: string;
}
export interface AdminRestaurant {
  id: string; name: string; active: boolean; suspendedReason?: string | null; source?: string;
  owner?: { fullName: string; email: string } | null;
}
export interface AdminUser { id: string; fullName: string; email: string; role: UserRole }
export interface PageData<T> { data: T[]; page: number; limit: number; total: number }
export const numberText = (value: number) => Number(value).toLocaleString('vi-VN');

// Bỏ kết quả cũ khi đổi trang/bộ lọc hoặc rời trang trong lúc API đang chạy.
export function useAdminData<T>(path: string) {
  const [result, setResult] = useState<{ path: string; data: T | null; error: string; loading: boolean }>({ path, data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    setResult({ path, data: null, error: '', loading: true });
    request(path).then((data: T) => {
      if (current) setResult({ path, data, error: '', loading: false });
    }).catch((error: Error) => {
      if (current) setResult({ path, data: null, error: error.message || 'Không thể tải dữ liệu. Vui lòng thử lại.', loading: false });
    });
    return () => { current = false; };
  }, [path, revision]);
  return { data: result.path === path ? result.data : null, error: result.path === path ? result.error : '', loading: result.path !== path || result.loading, refresh };
}
