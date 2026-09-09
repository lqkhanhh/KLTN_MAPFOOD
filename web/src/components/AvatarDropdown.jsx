import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

const ROLE_LABELS = { customer: 'Khách hàng', merchant: 'Chủ quán', admin: 'Quản trị viên' };

export default function AvatarDropdown() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const ref = useRef(null);
  const closePassword = useCallback(() => setShowPassword(false), []);
  useEffect(() => {
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, []);
  if (!currentUser) return <button className="header-login" type="button" onClick={() => navigate('/login')}>Đăng nhập</button>;
  const initials = (currentUser.fullName || '').split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'RB';
  const go = (path) => { setOpen(false); navigate(path); };
  return <>
    <div className="avatar-dropdown" ref={ref}>
      <button className="profile-trigger" type="button" aria-label="Mở menu tài khoản" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{initials}</button>
      {open && <div className="avatar-menu" role="menu">
        <header className="rb-account-summary"><span className="rb-account-initials" aria-hidden="true">{initials}</span>
          <div><strong>{currentUser.fullName}</strong><span className="rb-account-role">{ROLE_LABELS[currentUser.role] || currentUser.role}</span></div>
        </header>
        <div className="avatar-menu-items">
          <MenuItem label="Thông tin tài khoản" onClick={() => go(currentUser.role === 'merchant' ? '/merchant/profile' : '/profile')} />
          <MenuItem label="Đổi mật khẩu" onClick={() => { setOpen(false); setShowPassword(true); }} />
          <MenuItem label="Quán đã lưu" onClick={() => go('/my-favorites')} />
          {currentUser.role === 'customer' && <MenuItem label="Điểm của tôi" onClick={() => go('/my-points')} />}
          {currentUser.role === 'merchant' ? <><MenuItem label="Quản lý quán" onClick={() => go('/merchant/dashboard')} /><MenuItem label="Đơn hàng của quán" onClick={() => go('/merchant/orders')} /></>
            : currentUser.role === 'admin' ? <MenuItem label="Quản trị hệ thống" onClick={() => go('/admin/overview')} />
              : <><MenuItem label="Đơn của tôi" onClick={() => go('/my-orders')} /><MenuItem label="Giỏ hàng của tôi" onClick={() => go('/my-carts')} /></>}
        </div>
        <div className="avatar-menu-logout"><MenuItem label="Đăng xuất" danger onClick={() => { setOpen(false); logout(); navigate('/login'); }} /></div>
      </div>}
    </div>
    {showPassword && <ChangePasswordModal onClose={closePassword} />}
  </>;
}
function MenuItem({ label, onClick, danger }) {
  return <button type="button" role="menuitem" className={danger ? 'danger' : ''} onClick={onClick}><span>{label}</span></button>;
}
