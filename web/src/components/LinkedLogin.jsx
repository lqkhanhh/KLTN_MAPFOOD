import { useEffect, useState } from 'react';
import { request } from '../api';
import ProviderLogin from './ProviderLogin';

export default function LinkedLogin() {
  const [status, setStatus] = useState(null), [password, setPassword] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { let active = true; request('/auth/firebase/status').then(value => { if (active) setStatus(value); }).catch(() => { if (active) setMessage('Chưa tải được trạng thái liên kết. Vui lòng tải lại trang.'); }); return () => { active = false; }; }, []);
  async function link(idToken) {
    const result = await request('/auth/firebase/link', { method: 'POST', body: { idToken, password } });
    setStatus({ ...status, linked: true }); setPassword(''); setMessage(result.message);
  }
  return <section className="rb-linked-login"><h2>Phương thức đăng nhập</h2>
    {message && <p role="status">{message}</p>}
    {!status ? <p>Đang tải…</p> : status.linked ? <p>Đã liên kết danh tính đăng nhập. Đăng nhập bằng Google không yêu cầu thêm OTP email; đăng nhập bằng mật khẩu cần xác minh OTP.</p> : status.hasPassword ? <>
      <p>Giữ nguyên đơn hàng và quyền tài khoản khi đăng nhập bằng phương thức mới.</p>
      <label>Mật khẩu hiện tại để liên kết<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
      <ProviderLogin onToken={link} disabled={!password} linking />
    </> : <p>Tài khoản này không có mật khẩu riêng. Hãy dùng phương thức Google đã liên kết. Nếu trước đây chỉ dùng OTP email, hãy liên hệ quản trị viên để hỗ trợ thiết lập mật khẩu.</p>}
  </section>;
}
