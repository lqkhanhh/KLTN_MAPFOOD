import { useEffect, useRef, useState } from 'react';
import { prepareAuth, providerPopup, clearFirebaseSession, authError } from '../utils/firebaseAuth';

export default function ProviderLogin({ onToken, disabled = false, linking = false, onBusyChange }) {
  const [settings, setSettings] = useState(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    prepareAuth().then(value => { if (mounted.current) setSettings(value); })
      .catch(() => { if (mounted.current) setError('Chưa tải được đăng nhập Google. Vui lòng tải lại trang.'); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);
  async function google() {
    if (lock.current || busy || disabled || !settings?.providers.google) return;
    lock.current = true; setBusy(true); setError(''); onBusyChange?.(true);
    try {
      const result = await providerPopup(settings.auth, 'google');
      if (mounted.current) await onToken(await result.user.getIdToken(true));
    } catch (err) { if (mounted.current) setError(authError(err)); }
    finally {
      await clearFirebaseSession(settings.auth);
      lock.current = false;
      if (mounted.current) { setBusy(false); onBusyChange?.(false); }
    }
  }
  return <section className="rb-provider-login" aria-label={linking ? 'Liên kết Google' : 'Đăng nhập Google'}>
    {!linking && <div className="rb-auth-divider"><span>hoặc tiếp tục với</span></div>}
    <div className="rb-provider-buttons"><button type="button" disabled={loading || busy || disabled || !settings?.providers.google} onClick={google}>{linking ? 'Liên kết Google' : 'Google'}</button></div>
    {loading ? <p role="status">Đang tải đăng nhập Google…</p> : !settings?.providers.google && <p className="rb-auth-note">Google sẽ khả dụng khi quản trị viên hoàn tất cấu hình.</p>}
    {busy && <p role="status">Đang xác minh Google…</p>}
    {error && <p className="auth-alert" role="alert">{error}</p>}
  </section>;
}
