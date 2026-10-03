import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { request } from '../api';
import { useAuth } from '../contexts/AuthContext';
interface Turn { role: 'user' | 'assistant'; content: string; source?: 'ai' | 'faq' }
const QUESTIONS = ['Làm sao hủy đơn?', 'VNPAY bị lỗi phải làm gì?', 'Quán chưa xác nhận thì sao?', 'Cách tích xu và dùng voucher?', 'Làm sao tìm quán trên đường đi?', 'Làm sao nhắn tin với quán?'];
function relatedQuestions(message: string) {
  if (/VNPAY|thanh toán|voucher|xu/i.test(message)) return [QUESTIONS[1], QUESTIONS[3], QUESTIONS[5]].filter(q => q !== message);
  if (/hủy|xác nhận/i.test(message)) return [QUESTIONS[0], QUESTIONS[2], QUESTIONS[5]].filter(q => q !== message);
  return QUESTIONS.filter(q => q !== message).slice(0, 3);
}
export function AiSupportWidget() {
  const { currentUser } = useAuth(); const { pathname } = useLocation();
  if (currentUser?.role !== 'customer' || pathname.startsWith('/merchant') || pathname.startsWith('/admin')) return null;
  return <SupportWidget key={currentUser.id} />;
}
function SupportWidget() {
  const [open, setOpen] = useState(false), [orderChatOpen, setOrderChatOpen] = useState(false);
  const [messages, setMessages] = useState<Turn[]>([]), [input, setInput] = useState(''), [pending, setPending] = useState(''), [error, setError] = useState('');
  const busy = useRef(false), alive = useRef(true), field = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null), panel = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    alive.current = true;
    const orderChat = (event: Event) => { const value = Boolean((event as CustomEvent).detail); setOrderChatOpen(value); if (value) setOpen(false); };
    setOrderChatOpen(Boolean(document.querySelector('.rb-chat-drawer')));
    window.addEventListener('routebite:order-chat-open', orderChat);
    return () => { alive.current = false; window.removeEventListener('routebite:order-chat-open', orderChat); };
  }, []);
  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && panel.current?.contains(document.activeElement)) { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [open]);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages.length, pending, open]);
  async function send(event?: FormEvent, suggestion?: string) {
    event?.preventDefault(); const message = (suggestion ?? input).trim();
    if (!message || busy.current) return;
    busy.current = true; setInput(message); setPending(message); setError('');
    // Chỉ gửi tối đa 5 lượt hỏi/đáp gần nhất, giới hạn tổng ký tự trước khi gọi API.
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    while (history.reduce((sum, turn) => sum + turn.content.length, message.length) > 14000 && history.length) history.splice(0, 2);
    try {
      const result = await request('/support/ai-chat', { method: 'POST', body: { message, history } });
      if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('Trợ lý chưa trả lời. Vui lòng thử lại.');
      if (alive.current) { setMessages((rows) => [...rows, { role: 'user', content: message }, { role: 'assistant', content: result.reply, source: result.source }]); setInput(''); }
    } catch (e) { if (alive.current) setError(e.message || 'Không kết nối được trợ lý AI. Nội dung câu hỏi vẫn được giữ để thử lại.'); }
    finally { busy.current = false; if (alive.current) { setPending(''); setTimeout(() => field.current?.focus(), 0); } }
  }
  if (orderChatOpen) return null;
  return <>
    <button ref={trigger} className="rb-ai-trigger" type="button" aria-label="Hỗ trợ AI" aria-expanded={open} aria-controls="ai-support-panel" onClick={() => setOpen(!open)}>AI</button>
    {open && <section ref={panel} id="ai-support-panel" className="rb-ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-support-title">
      <header><div><h2 id="ai-support-title">Trợ lý RouteBite</h2><small>AI hướng dẫn · Không phải nhân viên của quán</small></div><button type="button" aria-label="Đóng hỗ trợ AI" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      <p className="rb-ai-disclaimer">Chọn câu hỏi bên dưới để được hướng dẫn. Khi AI chưa sẵn sàng, hệ thống dùng câu trả lời có sẵn; khi AI được cấu hình, câu hỏi được gửi tới Anthropic. Không gửi mật khẩu hoặc OTP. Trợ lý không thao tác đơn hàng thay bạn.</p>
      <div className="rb-ai-messages" ref={list} role="log" aria-label="Hội thoại hỗ trợ AI" aria-live="polite">
        {!messages.length && !pending && <div><p>Xin chào! Bạn cần hỗ trợ gì về RouteBite?</p><p>Bấm một câu hỏi để xem câu trả lời, không cần nhập lại.</p><div className="rb-ai-suggestions" aria-label="Câu hỏi thường gặp">{QUESTIONS.map((text) => <button type="button" key={text} onClick={() => void send(undefined, text)}>{text}</button>)}</div></div>}
        {messages.map((turn, i) => <article key={i} className={`rb-ai-message ${turn.role}`}><small>{turn.role === 'user' ? 'Bạn' : turn.source === 'faq' ? 'Hướng dẫn có sẵn · AI chưa được cấu hình' : 'Trợ lý AI'}</small><p>{turn.content}</p></article>)}
        {pending && <><article className="rb-ai-message user"><small>Bạn</small><p>{pending}</p></article><p role="status">Đang trả lời…</p></>}
        {!!messages.length && !pending && <div><p>Bạn muốn tìm hiểu thêm?</p><div className="rb-ai-suggestions" aria-label="Câu hỏi liên quan">{relatedQuestions(messages[messages.length - 2]?.content || '').map(text => <button key={text} type="button" onClick={() => void send(undefined, text)}>{text}</button>)}</div></div>}
      </div>
      {error && <p className="rb-ai-error" role="alert">{error}</p>}
      <div className="rb-ai-actions"><Link to="/my-orders" onClick={() => setOpen(false)}>Mở đơn để nhắn tin với quán</Link><button type="button" disabled={!!pending} onClick={() => { setMessages([]); setError(''); }}>Hội thoại mới</button></div>
      <form onSubmit={send}><label><span>Câu hỏi</span><input ref={field} value={input} maxLength={1000} disabled={!!pending} onChange={(e) => setInput(e.target.value)} placeholder="Nhập câu hỏi..." /></label><button type="submit" disabled={!!pending || !input.trim()}>{pending ? 'Đang gửi…' : 'Gửi'}</button></form>
    </section>}
  </>;
}
