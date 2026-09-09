import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChatInbox } from '../contexts/ChatInboxContext';
export function ChatBell() {
  const { currentUser } = useAuth(); const { conversations, totalUnread, loading, error, refresh } = useChatInbox();
  const [open, setOpen] = useState(false); const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate(), location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname, location.search, currentUser?.id]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!['customer', 'merchant'].includes(currentUser?.role)) return null;
  return <div className="rb-chat-bell" ref={container}>
    <button ref={trigger} className="rb-chat-bell-trigger" type="button" aria-label={totalUnread ? `Tin nhắn, ${totalUnread} chưa đọc` : 'Tin nhắn'} aria-controls="chat-inbox-panel" aria-expanded={open}
      onClick={() => { setOpen(!open); if (!open) void refresh(); }}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z" /><path d="M7 10h10M7 14h6" /></svg>
      {totalUnread > 0 && <span className="rb-chat-unread" aria-hidden="true">{totalUnread > 9 ? '9+' : totalUnread}</span>}
    </button>
    {open && <section id="chat-inbox-panel" className="rb-chat-inbox" aria-label="Hộp thư tin nhắn"><header><h2>Tin nhắn</h2></header>
      {loading && <p role="status">Đang tải cuộc trò chuyện…</p>}
      {error && <div className="rb-inbox-error"><p role="alert">{error}</p><button type="button" onClick={refresh}>Thử lại</button></div>}
      {!loading && !error && !conversations.length && <p>Chưa có tin nhắn nào.</p>}
      {conversations.map((row) => <button key={row.orderId} className={`rb-conversation${row.unreadCount ? ' unread' : ''}`} type="button" onClick={() => {
        setOpen(false); navigate(`${currentUser.role === 'merchant' ? '/merchant' : ''}/orders/${encodeURIComponent(row.orderId)}?chat=1`);
      }}><span><strong>{currentUser.role === 'merchant' ? row.customerName : row.restaurantName}</strong>{row.unreadCount > 0 && <b>{row.unreadCount}</b>}</span>
        <small>{row.orderCode}</small><span className="rb-conversation-preview">{row.lastMessage.senderId === currentUser.id ? 'Bạn: ' : ''}{row.lastMessage.content}</span>
        <time dateTime={row.lastMessage.createdAt}>{new Date(row.lastMessage.createdAt).toLocaleString('vi-VN')}</time>
      </button>)}
    </section>}
  </div>;
}
