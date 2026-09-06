import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import { request } from './api';
import { useAuth } from './contexts/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate(); const { setSession } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' }); const [fieldErrors, setFieldErrors] = useState({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setError(''); setFieldErrors({});
    if (form.password.length < 6) return setFieldErrors({ password: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    if (form.password !== form.confirmPassword) return setFieldErrors({ confirmPassword: 'Mật khẩu xác nhận không khớp.' });
    setBusy(true);
    try { const data = await request('/auth/register', { method: 'POST', authorized: false, body: { fullName: form.fullName, email: form.email, phone: form.phone || undefined, password: form.password } }); setSession(data); navigate('/'); }
    catch (err) { if (/email/i.test(err.message || '')) setFieldErrors({ email: 'Email này đã được sử dụng.' }); else setError(err.message || 'Đăng ký thất bại, vui lòng thử lại.'); } finally { setBusy(false); }
  }
  return <AuthLayout><div className="auth-heading"><p>BẮT ĐẦU CÙNG ROUTEBITE</p><h2>Tạo tài khoản</h2><span>Tài khoản đăng ký mới mặc định là thực khách.</span></div>{error && <div className="auth-alert" role="alert">{error}</div>}<form className="auth-form" onSubmit={submit}><label>Họ và tên<input value={form.fullName} onChange={change('fullName')} placeholder="Nguyễn Văn A" required autoComplete="name" /></label><label>Email<input className={fieldErrors.email ? 'has-error' : ''} type="email" value={form.email} onChange={change('email')} placeholder="you@example.com" required autoComplete="email" />{fieldErrors.email && <small>{fieldErrors.email}</small>}</label><label>Số điện thoại <em>(cần khi đặt món)</em><input type="tel" value={form.phone} onChange={change('phone')} placeholder="0900 000 000" autoComplete="tel" /></label><label>Mật khẩu<input className={fieldErrors.password ? 'has-error' : ''} type="password" value={form.password} onChange={change('password')} placeholder="Ít nhất 6 ký tự" required autoComplete="new-password" />{fieldErrors.password && <small>{fieldErrors.password}</small>}</label><label>Xác nhận mật khẩu<input className={fieldErrors.confirmPassword ? 'has-error' : ''} type="password" value={form.confirmPassword} onChange={change('confirmPassword')} placeholder="Nhập lại mật khẩu" required autoComplete="new-password" />{fieldErrors.confirmPassword && <small>{fieldErrors.confirmPassword}</small>}</label><button className="auth-submit" disabled={busy}>{busy ? 'Đang đăng ký…' : 'Đăng ký'}</button></form><p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p></AuthLayout>;
}
