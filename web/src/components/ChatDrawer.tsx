import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useSockets } from '../contexts/SocketContext';
import { useChatInbox } from '../contexts/ChatInboxContext';

interface Message { id: string; orderId: string; senderId: string; senderRole: string; content: string; createdAt: string; isRead?: boolean }
const mergeMessages = (old: Message[], incoming: Message[], orderId: string) => {
  const map = new Map(old.map((message) => [message.id, message]));
  for (const message of incoming) if (message.orderId === orderId && message.id && typeof message.content === 'string') map.set(message.id, message);
  return [...map.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
};
export function ChatDrawer({ orderId, orderCode, onClose }: { orderId: string; orderCode?: string; onClose: () => void }) {
  const { currentUser } = useAuth();
  const { chat: socket } = useSockets();
  const { refresh: refreshInbox } = useChatInbox();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  const [viewRevision, setViewRevision] = useState(0);
  const [readError, setReadError] = useState('');
  const busy = useRef(false), alive = useRef(true), followBottom = useRef(true);
  const drawer = useRef<HTMLElement>(null), list = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { if (allowed) field.current?.focus(); }, [allowed]);
  useEffect(() => {
    alive.current = true; field.current?.focus();
    window.dispatchEvent(new CustomEvent('routebite:order-chat-open', { detail: true }));
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy.current && drawer.current?.contains(document.activeElement)) close.current(); };
    document.addEventListener('keydown', escape);
    return () => { alive.current = false; document.removeEventListener('keydown', escape); window.dispatchEvent(new CustomEvent('routebite:order-chat-open', { detail: false })); };
  }, []);
  useEffect(() => {
    let active = true, sequence = 0;
    const load = async () => {
      const version = ++sequence;
      try {
        const rows = await request(`/orders/${orderId}/messages`);
        if (!Array.isArray(rows)) throw new Error();
        if (active && version === sequence) { setMessages((old) => mergeMessages(old, rows, orderId)); setAllowed(true); setError(''); }
      } catch (cause: any) {
        if (active && version === sequence) {
          if ([401, 403, 404].includes(cause.status)) { setAllowed(false); setMessages([]); }
          setError([401, 403].includes(cause.status) ? 'Bạn không có quyền mở chat hoặc phiên đăng nhập đã hết hạn.' : 'Không thể tải tin nhắn. Vui lòng thử lại.');
        }
      } finally { if (active && version === sequence) setLoading(false); }
    };
    void load();
    const join = () => {
      socket?.timeout(5000).emit('join', { orderId }, (failure: any, response: any) => {
        if (active) { setConnected(!failure && response?.ok === true); void load(); }
      });
    };
    const receive = (message: Message) => { if (active && message.orderId === orderId) setMessages((old) => mergeMessages(old, [message], orderId)); };
    const offline = () => { if (active) setConnected(false); };
    socket?.on('connect', join); socket?.on('message.new', receive); socket?.on('disconnect', offline); socket?.on('connect_error', offline);
    if (socket?.connected) join(); else socket?.connect();
    // REST dự phòng: người gửi vẫn thấy tin đã lưu khi socket mất kết nối.
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false; window.clearInterval(timer);
      socket?.off('connect', join); socket?.off('message.new', receive); socket?.off('disconnect', offline); socket?.off('connect_error', offline);
      if (socket?.connected) socket.emit('leave', { orderId });
    };
  }, [orderId, socket, revision]);
  useEffect(() => { if (followBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages.length]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') setViewRevision((n) => n + 1); };
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
  }, []);
  useEffect(() => {
    if (!allowed || document.visibilityState !== 'visible' || !followBottom.current) return;
    const ids = messages.filter((m) => m.isRead === false && m.senderId !== currentUser?.id).map((m) => m.id);
    if (!ids.length) return;
    let active = true;
    const mark = async () => {
      try {
        const readIds = new Set<string>();
        for (let i = 0; i < ids.length; i += 200) {
          const result = await request(`/orders/${orderId}/messages/read`, { method: 'PATCH', body: { messageIds: ids.slice(i, i + 200) } });
          for (const id of result.messageIds || []) readIds.add(id);
        }
        if (active) { setReadError(''); if (readIds.size) setMessages((rows) => rows.map((m) => readIds.has(m.id) ? { ...m, isRead: true } : m)); }
        await refreshInbox();
      } catch { if (active) setReadError('Chưa cập nhật được trạng thái đã đọc.'); }
    };
    void mark(); return () => { active = false; };
  }, [messages, allowed, orderId, currentUser?.id, viewRevision, refreshInbox]);
  async function send(event: FormEvent) {
    event.preventDefault(); const content = input.trim();
    if (!content || busy.current || !allowed) return;
    busy.current = true; setSending(true); setError('');
    try {
      const message = await request(`/orders/${orderId}/messages`, { method: 'POST', body: { content } });
      if (alive.current) { followBottom.current = true; setMessages((old) => mergeMessages(old, [message], orderId)); setInput(''); }
    } catch (cause: any) {
      if (alive.current) {
        if ([401, 403, 404].includes(cause.status)) { setAllowed(false); setMessages([]); }
        setError('Chưa gửi được tin nhắn. Nội dung vẫn được giữ để bạn thử lại.');
      }
    } finally { busy.current = false; if (alive.current) { setSending(false); field.current?.focus(); } }
  }
  return <section ref={drawer} className="rb-chat-drawer" role="dialog" aria-modal="false" aria-labelledby="chat-title">
    <header><div><h2 id="chat-title">Nhắn tin về đơn hàng</h2><small>{orderCode || orderId}</small></div>
      <button type="button" aria-label="Đóng trò chuyện" disabled={sending} onClick={onClose}>×</button></header>
    <p className="rb-chat-connection">{connected ? 'Đã kết nối realtime' : 'Đang kết nối realtime · tự tải lại mỗi 15 giây'}</p>
    {error && <div className="rb-chat-error" role="alert">{error}<button type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>}
    {readError && <div className="rb-chat-error">{readError}<button type="button" onClick={() => setViewRevision((n) => n + 1)}>Thử lại</button></div>}
    <div className="rb-chat-messages" ref={list} role="log" aria-label="Tin nhắn của đơn" aria-live="polite" onScroll={() => {
      const node = list.current; if (node) { const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 60; if (bottom && !followBottom.current) setViewRevision((n) => n + 1); followBottom.current = bottom; }
    }}>
      {loading ? <p>Đang tải tin nhắn…</p> : !messages.length && !error ? <p>Chưa có tin nhắn. Hãy trao đổi về đơn hàng tại đây.</p> : null}
      {messages.map((message) => <article key={message.id} className={`rb-chat-message${message.senderId === currentUser?.id ? ' mine' : ''}`}>
        <small>{message.senderId === currentUser?.id ? 'Bạn' : message.senderRole === 'merchant' ? 'Quán' : 'Khách hàng'}</small>
        <p>{message.content}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</time>
      </article>)}
    </div>
    <form onSubmit={send}><label className="rb-chat-input"><span>Tin nhắn</span><input ref={field} placeholder="Nhập tin nhắn..." maxLength={2000} disabled={sending || !allowed} value={input} onChange={(event) => setInput(event.target.value)} /></label>
      <button className="btn primary" type="submit" disabled={sending || !allowed || !input.trim()}>{sending ? 'Đang gửi…' : 'Gửi'}</button></form>
  </section>;
}
