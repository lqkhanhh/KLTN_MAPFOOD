import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const ROLE_LABELS = { customer: 'Khách hàng', merchant: 'Chủ quán', admin: 'Quản trị viên' };

export default function ProfilePage() {
  const { currentUser } = useAuth(); if (!currentUser) return <Navigate to="/login" replace />;
  return <main className="profile-page"><section className="profile-card"><p>THÔNG TIN TÀI KHOẢN</p><h1>Hồ sơ của bạn</h1><div className="profile-avatar">{currentUser.fullName.split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase()}</div><div className="profile-rows"><InfoRow label="Họ và tên" value={currentUser.fullName} /><InfoRow label="Email" value={currentUser.email} /><InfoRow label="Số điện thoại" value={currentUser.phone || 'Chưa cập nhật'} /><InfoRow label="Vai trò" value={ROLE_LABELS[currentUser.role] || currentUser.role} /></div><small>Chức năng chỉnh sửa thông tin và đổi mật khẩu sẽ được bổ sung trong bản cập nhật tiếp theo.</small></section></main>;
}
function InfoRow({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
