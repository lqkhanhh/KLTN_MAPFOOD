import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcon } from '../components/MaterialIcon';

const ADMIN_NAV = [
  { path: '/admin/overview', label: 'Tổng quan' },
  { path: '/admin/restaurants', label: 'Quán ăn' },
  { path: '/admin/users', label: 'Người dùng' },
  { path: '/admin/vouchers', label: 'Voucher' },
  { path: '/admin/merchant-applications', label: 'Hồ sơ đối tác' },
];

export function AdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  return <div className="rb-admin-shell rb-merchant-shell">
    <aside className="rb-merchant-sidebar">
      <div className="rb-merchant-brand"><strong>RouteBite</strong><span>Quản trị hệ thống</span></div>
      <nav aria-label="Điều hướng admin">{ADMIN_NAV.map((item) => <NavLink key={item.path} to={item.path}
        className={({ isActive }) => isActive ? 'active' : ''}><MaterialIcon name={item.path.endsWith('overview') ? 'dashboard' : item.path.endsWith('restaurants') ? 'shop' : item.path.endsWith('users') ? 'users' : item.path.endsWith('vouchers') ? 'voucher' : 'documents'} /><span>{item.label}</span></NavLink>)}</nav>
      <footer><strong>{currentUser?.fullName || 'Quản trị viên'}</strong><button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Đăng xuất</button></footer>
    </aside>
    <main className="rb-admin-content rb-merchant-content"><Outlet /></main>
  </div>;
}
