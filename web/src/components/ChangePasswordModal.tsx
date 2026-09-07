import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '../api';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [success, onClose]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (newPassword.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự');
    if (newPassword !== confirmPassword) return setError('Mật khẩu xác nhận không khớp');
    if (newPassword === oldPassword) return setError('Mật khẩu mới phải khác mật khẩu hiện tại');
    setLoading(true);
    try {
      await request('/auth/change-password', { method: 'PATCH', body: { oldPassword, newPassword } });
      localStorage.removeItem('routebite_refresh_token');
      setSuccess(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể đổi mật khẩu. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }
  return <dialog ref={dialog} className="rb-password-dialog" aria-labelledby="password-title" onCancel={(event) => { event.preventDefault(); if (!loading) onClose(); }}>
    <h2 id="password-title">Đổi mật khẩu</h2>
    {success ? <p role="status" className="rb-pickup-due">Đổi mật khẩu thành công!</p> : <form className="auth-form" onSubmit={submit}>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" required disabled={loading} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} /></label>
      <label>Mật khẩu mới<input type="password" autoComplete="new-password" required disabled={loading} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      <label>Xác nhận mật khẩu mới<input type="password" autoComplete="new-password" required disabled={loading} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      <div className="rb-dialog-actions"><button type="button" className="btn secondary" disabled={loading} onClick={onClose}>Hủy</button><button type="submit" className="btn primary" disabled={loading}>{loading ? 'Đang lưu…' : 'Xác nhận'}</button></div>
    </form>}
  </dialog>;
}
