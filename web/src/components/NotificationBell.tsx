import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';

export function NotificationBell() {
  const { currentUser } = useAuth();
  const { notifications, unreadCount, loading, error, refresh, markRead, markAll } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); setActionError(''); }, [location.pathname, currentUser]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!currentUser) return null;

  async function read(notification?: any) {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      if (notification) {
        await markRead(notification);
        setOpen(false);
        if (typeof notification.data?.orderId === 'string') navigate(`${currentUser.role === 'merchant' ? '/merchant' : ''}/orders/${encodeURIComponent(notification.data.orderId)}`);
      } else await markAll();
    } catch { setActionError('Không thể đánh dấu đã đọc. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <div className="rb-notification-bell" ref={container}>
    <button ref={trigger} className="rb-notification-trigger" type="button" aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
      aria-expanded={open} aria-controls="notification-panel" onClick={() => { setOpen(!open); if (!open) void refresh(); }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unreadCount > 0 && <span className="rb-notification-count" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <section className="rb-notification-panel" id="notification-panel" aria-label="Danh sách thông báo">
      <header><h2>Thông báo</h2><button type="button" disabled={busy || !unreadCount} onClick={() => read()}>Đọc tất cả</button></header>
      {(error || actionError) && <div className="rb-notification-feedback"><p role="alert">{actionError || error}</p>{error && <button type="button" onClick={refresh}>Thử lại</button>}</div>}
      {loading ? <p className="rb-notification-feedback" role="status">Đang tải thông báo…</p>
        : !notifications.length && !error ? <p className="rb-notification-feedback">Chưa có thông báo nào</p> : null}
      <div className="rb-notification-list">{notifications.map((notification: any) => <button key={notification.id} type="button" disabled={busy}
        className={`rb-notification-item${notification.isRead ? '' : ' unread'}`} onClick={() => read(notification)}>
        <strong>{notification.title}</strong><span>{notification.body}</span>
        <small>{!notification.isRead && 'Chưa đọc · '}{new Date(notification.createdAt).toLocaleString('vi-VN')}</small>
      </button>)}</div>
    </section>}
  </div>;
}
