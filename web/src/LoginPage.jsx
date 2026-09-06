import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import { request } from './api';
import { useAuth } from './contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate(); const { setSession } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request('/auth/login', { method: 'POST', body: { email, password }, authorized: false });
      setSession(data);
      if (data.user.role === 'merchant') { const restaurants = await request('/restaurants/mine'); navigate(restaurants.length ? '/merchant' : '/merchant/onboarding'); }
      else if (data.user.role === 'admin') navigate('/admin/overview'); else navigate('/');
    } catch (err) { setError(err.message || 'Đăng nhập thất bại, vui lòng thử lại.'); } finally { setBusy(false); }
  }
  return <AuthLayout><div className="auth-heading"><p>CHÀO MỪNG TRỞ LẠI</p><h2>Đăng nhập</h2><span>Đăng nhập để tiếp tục hành trình của bạn.</span></div>{error && <div className="auth-alert" role="alert">{error}</div>}<form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><label>Mật khẩu<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" required autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ẩn' : 'Hiện'}</button></div></label><button className="auth-submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form><p className="auth-switch">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p></AuthLayout>;
}
