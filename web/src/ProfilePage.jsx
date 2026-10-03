import LinkedLogin from './components/LinkedLogin';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { request } from './api';
import { useAuth } from './contexts/AuthContext';

const ROLE_LABELS = { customer: 'Khách hàng', merchant: 'Chủ quán', admin: 'Quản trị viên' };

export default function ProfilePage() {
  const { currentUser } = useAuth();
  return currentUser ? <EditableProfile key={currentUser.id} /> : <Navigate to="/login" replace />;
}
function EditableProfile() {
  const { currentUser, setCurrentUser } = useAuth();
  const [name, setName] = useState(currentUser.fullName || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    request('/auth/profile').then(user => {
      if (active) { setCurrentUser(user); setName(user.fullName); setPhone(user.phone || ''); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event) {
    event.preventDefault(); if (saving) return;
    const fullName = name.trim(), normalizedPhone = phone.replace(/[\s.-]/g, '');
    setError(''); setSuccess('');
    if (!fullName || !/^(?:0|\+84)[35789]\d{8}$/.test(normalizedPhone)) {
      setError('Vui lòng nhập họ tên và số điện thoại di động Việt Nam hợp lệ.'); return;
    }
    setSaving(true);
    try {
      const user = await request('/auth/profile', { method: 'PATCH', body: { fullName, phone: normalizedPhone } });
      setCurrentUser(user); setName(user.fullName); setPhone(user.phone);
      setSuccess('Đã lưu hồ sơ. Thông tin mới sẽ được dùng cho các đơn hàng tiếp theo.');
    } catch (e) { setError(e.message || 'Chưa lưu được hồ sơ. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  }
  return <main className="profile-page"><section className="profile-card">
    <p>THÔNG TIN TÀI KHOẢN</p><h1>Hồ sơ của bạn</h1>
    <div className="profile-rows"><InfoRow label="Email" value={currentUser.email?.endsWith('@identity.routebite.invalid') ? 'Chưa cung cấp email' : currentUser.email} /><InfoRow label="Vai trò" value={ROLE_LABELS[currentUser.role]} /></div>
    {loading && <p role="status">Đang tải hồ sơ…</p>}
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    <form onSubmit={save} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
      <label style={{ display: 'grid', gap: 8 }}>Họ và tên<input autoComplete="name" value={name} maxLength={120} required disabled={loading || saving} onChange={e => { setName(e.target.value); setSuccess(''); }} /></label>
      <label style={{ display: 'grid', gap: 8 }}>Số điện thoại<input type="tel" autoComplete="tel" value={phone} maxLength={20} required disabled={loading || saving} placeholder="Ví dụ: 0901234567" onChange={e => { setPhone(e.target.value); setSuccess(''); }} /></label>
      <small>Số điện thoại dùng để quán liên hệ khi bạn đặt món.</small>
      <button className="btn primary" type="submit" disabled={loading || saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </form>
    <LinkedLogin />
  </section></main>;
}
function InfoRow({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
