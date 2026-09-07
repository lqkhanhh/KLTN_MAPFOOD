import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMerchant } from '../contexts/MerchantContext';
import { NotificationBell } from '../components/NotificationBell';
import AvatarDropdown from '../components/AvatarDropdown';

const navItems = [{ path: '/merchant/dashboard', label: 'Tổng quan' }, { path: '/merchant/menu', label: 'Quản lý Menu' }, { path: '/merchant/orders', label: 'Đơn hàng' }];
export function MerchantLayout() {
  const { currentUser, logout } = useAuth();
  const { restaurants, selectedId, setSelectedId, loading, error, refresh, dirty, saving } = useMerchant();
  const navigate = useNavigate(); const location = useLocation();
  const canLeave = () => !saving && (!dirty || window.confirm('Có thay đổi menu chưa lưu. Bạn muốn rời trang và bỏ các thay đổi này?'));
  const onboarding = location.pathname === '/merchant/onboarding';
  return <div className="rb-merchant-shell">
    <aside className="rb-merchant-sidebar"><div className="rb-merchant-brand"><strong>RouteBite</strong><span>Không gian Merchant</span></div>
      <nav aria-label="Điều hướng merchant">{navItems.map((item) => <NavLink key={item.path} to={item.path}
        className={({ isActive }) => isActive ? 'active' : ''} onClick={(event) => { if (location.pathname !== item.path && !canLeave()) event.preventDefault(); }}>{item.label}</NavLink>)}</nav>
      <footer><strong>{currentUser.fullName}</strong><button type="button" onClick={() => { if (canLeave()) { logout(); navigate('/login'); } }}>Đăng xuất</button></footer>
    </aside>
    <div className="rb-merchant-main">
      <header className="rb-merchant-toolbar"><div>
        {restaurants.length > 0 && <label>Quán đang quản lý<select aria-label="Quán đang quản lý" value={selectedId} disabled={saving} onChange={(event) => { if (canLeave()) setSelectedId(event.target.value); }}>
          {restaurants.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></label>}
      </div><div className="account-menu"><NotificationBell /><AvatarDropdown /></div></header>
      <main className="rb-merchant-content">
        {loading ? <p role="status">Đang tải quán của bạn…</p> : error ? <section className="item-card"><p role="alert">{error}</p><button className="btn secondary" onClick={refresh}>Thử lại</button></section>
          : !restaurants.length && !onboarding ? <Navigate to="/merchant/onboarding" replace /> : <Outlet />}
      </main>
    </div>
  </div>;
}
