import { useState } from 'react';
import { LoadError, Pagination } from './AdminShared';
import { ROLE_LABELS, useAdminData, type AdminUser, type PageData, type UserRole } from './adminData';

export function AdminUsersPage() {
  const [role, setRole] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(1);
  // Lọc ở backend vì danh sách trả về có phân trang, không lọc riêng 20 dòng đầu.
  const resource = useAdminData<PageData<AdminUser>>(`/admin/users?page=${page}&limit=20${role === 'all' ? '' : '&role=' + role}`);
  return <>
    <header className="rb-admin-heading"><p>QUẢN TRỊ HỆ THỐNG</p><h1>Người dùng</h1><span>Tra cứu tài khoản theo vai trò. Danh sách chỉ đọc.</span></header>
    <div className="rb-admin-filters" role="group" aria-label="Lọc vai trò">{(['all', 'customer', 'merchant', 'admin'] as const).map((value) => <button key={value} type="button" aria-pressed={value === role} onClick={() => { setRole(value); setPage(1); }}>{value === 'all' ? 'Tất cả' : ROLE_LABELS[value]}</button>)}</div>
    {resource.loading ? <p role="status">Đang tải người dùng…</p> : resource.error ? <LoadError error={resource.error} retry={resource.refresh} /> : resource.data && <>
      {resource.data.data.length ? <div className="item-card rb-admin-table-wrap" tabIndex={0} aria-label="Danh sách người dùng"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th></tr></thead><tbody>{resource.data.data.map((user) => <tr key={user.id}><td>{user.fullName || 'Chưa cập nhật'}</td><td>{user.email}</td><td>{ROLE_LABELS[user.role] || user.role}</td></tr>)}</tbody></table></div>
        : <section className="item-card">{role === 'all' ? 'Chưa có người dùng.' : 'Không có người dùng thuộc vai trò này.'}</section>}
      <Pagination page={page} total={resource.data.total} limit={20} onPage={setPage} />
    </>}
  </>;
}
