import { useEffect, useRef, useState } from 'react';
import { request } from '../api';

export default function EmailOtpLogin({ challenge, email, onSession, onBack, registration = false }) {
  const ticketField = registration ? 'registrationTicket' : 'loginTicket';
  const endpoint = registration ? '/auth/register' : '/auth/email-otp';
  const [pending, setPending] = useState(challenge), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState(Date.now() + challenge.expiresIn * 1000);
  const [retryAt, setRetryAt] = useState(Date.now() + challenge.retryAfter * 1000), [now, setNow] = useState(Date.now());
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000)), expired = now >= expiresAt;
  async function run(operation) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await operation(); }
    catch (err) { if (mounted.current) setError(err.message || 'Không thể xác minh. Vui lòng thử lại.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function verify(event) {
    event.preventDefault();
    if (expired || !/^\d{6}$/.test(code)) return;
    return run(async () => {
      const session = await request(`${endpoint}/verify`, { method: 'POST', authorized: false, body: { [ticketField]: pending[ticketField], code } });
      if (mounted.current) { setCode(''); await onSession(session); }
    });
  }
  function resend() {
    if (cooldown || expired) return;
    return run(async () => {
      const result = await request(`${endpoint}/resend`, { method: 'POST', authorized: false, body: { [ticketField]: pending[ticketField] } });
      if (!mounted.current) return;
      setPending(result); setCode(''); setNow(Date.now());
      setRetryAt(Date.now() + result.retryAfter * 1000); setExpiresAt(Date.now() + result.expiresIn * 1000);
    });
  }
  return <section className="rb-provider-login rb-email-otp" aria-label={registration ? 'Xác minh đăng ký' : 'Xác minh đăng nhập'}>
    <p role="status">Mã xác minh đã được gửi tới {email}. Kiểm tra cả thư rác.</p>
    <p className="rb-auth-note">Nhập mã 6 số để hoàn tất {registration ? 'đăng ký' : 'đăng nhập'}. Mã có hiệu lực 5 phút, chỉ dùng một lần.</p>
    {error && <p className="auth-alert" role="alert">{error}</p>}
    {expired && <p role="alert">Phiên xác minh đã hết hạn. Hãy quay lại nhập thông tin.</p>}
    <form className="auth-form" onSubmit={verify}>
      <label>Mã OTP email<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy || expired} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>
      <button className="auth-submit" type="submit" disabled={busy || expired || code.length !== 6}>{busy ? 'Đang xác minh…' : registration ? 'Xác minh và tạo tài khoản' : 'Xác minh và đăng nhập'}</button>
    </form>
    <div className="rb-provider-buttons" style={{ marginTop: 16 }}>
      <button type="button" disabled={busy || cooldown > 0 || expired} onClick={resend}>{cooldown ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã OTP'}</button>
      <button type="button" disabled={busy} onClick={onBack}>{registration ? 'Sửa thông tin đăng ký' : 'Quay lại đăng nhập'}</button>
    </div>
  </section>;
}
