import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS = { customer: 'Khách hàng', merchant: 'Chủ quán', admin: 'Quản trị viên' };

export default function AvatarDropdown() {
  const { currentUser, logout } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  if (!currentUser) return <button className="header-login" type="button" onClick={() => navigate('/login')}>Đăng nhập</button>;
  const initials = currentUser.fullName.split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'RB';
  const go = (path) => { setOpen(false); navigate(path); };
  return <div className="avatar-dropdown" ref={ref}><button className="profile-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{initials}</button>{open && <div className="avatar-menu" role="menu"><header><strong>{currentUser.fullName}</strong><span>{ROLE_LABELS[currentUser.role] || currentUser.role}</span></header><div className="avatar-menu-items"><MenuItem icon="👤" label="Thông tin tài khoản" onClick={() => go('/profile')} /><MenuItem icon="🔒" label="Đổi mật khẩu" disabled badge="Sắp ra mắt" /><MenuItem icon="📦" label="Đơn của tôi" onClick={() => go('/my-orders')} /></div><div className="avatar-menu-logout"><MenuItem icon="🚪" label="Đăng xuất" danger onClick={() => { logout(); navigate('/login'); }} /></div></div>}</div>;
}

function MenuItem({ icon, label, onClick, disabled, danger, badge }) { return <button type="button" role="menuitem" disabled={disabled} className={danger ? 'danger' : ''} onClick={onClick}><span>{icon}</span><b>{label}</b>{badge && <em>{badge}</em>}</button>; }
