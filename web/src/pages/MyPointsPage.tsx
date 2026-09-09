import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { money, OwnedVoucher, Voucher, voucherTerms } from '../loyalty';

interface Points { pointsBalance: number; transactions: { id: string; amount: number; type: 'earn' | 'redeem'; createdAt: string; orderId?: string }[]; }
export function MyPointsPage() {
  const { currentUser } = useAuth();
  return <PointsContent key={currentUser.id} />;
}
function PointsContent() {
  const [points, setPoints] = useState<Points | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [owned, setOwned] = useState<OwnedVoucher[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(true), sequence = useRef(0);
  async function load() {
    const seq = ++sequence.current;
    try {
      const [p, v, o] = await Promise.all([request('/points/me'), request('/vouchers/available'), request('/vouchers/my-vouchers')]);
      if (alive.current && seq === sequence.current) { setPoints(p); setVouchers(v); setOwned(o); setError(''); }
    } catch (e) { if (alive.current && seq === sequence.current) setError(e.message || 'Không tải được điểm và voucher.'); }
  }
  useEffect(() => { alive.current = true; void load(); const focus = () => { if (!lock.current) void load(); };
    window.addEventListener('focus', focus); return () => { alive.current = false; window.removeEventListener('focus', focus); }; }, []);
  async function obtain(v: Voucher) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await request(`/vouchers/${v.id}/${v.pointsCost === null ? 'claim' : 'redeem'}`, { method: 'POST' });
      if (alive.current) { setPoints((p) => p ? { ...p, pointsBalance: result.pointsBalance } : p); setMessage(result.alreadyClaimed ? 'Bạn đã nhận voucher này.' : 'Voucher đã được thêm vào ví của bạn.'); }
      await load();
    } catch (e) { if (alive.current) { setMessage(e.message); await load(); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <main className="app-page rb-loyalty-page">
    <header className="page-intro"><p className="rb-eyebrow">ƯU ĐÃI ROUTEBITE</p><h1>Điểm của tôi</h1><p>Tích xu từ đơn đã hoàn thành, đổi voucher cho lần ghé lấy tiếp theo.</p></header>
    <section className="item-card rb-points-balance"><span>Số dư hiện tại</span><strong>{points ? `${points.pointsBalance.toLocaleString('vi-VN')} xu` : 'Đang tải…'}</strong>
      {points && <span>≈ {money(points.pointsBalance * 1000)} giá trị đổi ưu đãi</span>}
      <p>Mỗi 100.000đ thực trả được 1 xu (1.000đ ưu đãi). Chỉ cộng khi đơn hoàn thành; phần lẻ dưới 1 xu được làm tròn xuống. Xu không quy đổi thành tiền mặt.</p></section>
    {error && <p role="alert">{error} <button className="btn secondary" disabled={busy} onClick={load}>Thử lại</button></p>}
    {message && <p role="status" className="item-card">{message}</p>}
    <h2>Voucher của tôi</h2><div className="rb-voucher-grid">
      {owned.map((row) => <article className="item-card" key={row.id}><h3>{row.voucher.title}</h3><p>{voucherTerms(row.voucher)}</p><code>{row.voucher.code}</code>
        <p>{row.usedInOrderId ? <Link to={`/orders/${row.usedInOrderId}`}>Đã dùng · Xem đơn</Link> : row.voucher.active ? 'Sẵn sàng dùng khi thanh toán' : 'Đã ngừng hoạt động'}</p></article>)}
      {points && !owned.length && <p>Bạn chưa có voucher. Đổi xu hoặc nhận ưu đãi bên dưới.</p>}
    </div><h2>Đổi xu và nhận ưu đãi</h2><div className="rb-voucher-grid">
      {vouchers.map((v) => { const claimed = v.pointsCost === null && owned.some((o) => o.voucherId === v.id && o.publicClaim);
        return <article className="item-card" key={v.id}><h3>{v.title}</h3><p>{voucherTerms(v)}</p><code>{v.code}</code>
          <button className="btn primary" type="button" disabled={busy || !points || claimed || (v.pointsCost !== null && points.pointsBalance < v.pointsCost)} onClick={() => obtain(v)}>
            {claimed ? 'Đã nhận' : v.pointsCost === null ? 'Nhận miễn phí' : `Đổi ${v.pointsCost} xu`}</button></article>; })}
      {points && !vouchers.length && <p>Hiện chưa có ưu đãi đang phát hành.</p>}
    </div><p className="rb-loyalty-note">Mỗi đơn dùng tối đa một voucher. Voucher được sử dụng khi tạo đơn thành công, không tự hoàn lại khi hủy đơn. Ưu đãi miễn phí chỉ được nhận một lần mỗi tài khoản.</p>
    <section className="item-card"><h2>Lịch sử xu</h2>{points?.transactions.length ? <ul className="rb-points-history">{points.transactions.map((tx) => <li key={tx.id}>
      <span>{tx.type === 'earn' ? 'Tích xu từ đơn hoàn thành' : 'Đổi voucher'}<small>{new Date(tx.createdAt).toLocaleString('vi-VN')}</small>{tx.orderId && <Link to={`/orders/${tx.orderId}`}>Xem đơn</Link>}</span>
      <strong>{tx.amount > 0 ? '+' : ''}{tx.amount} xu</strong></li>)}</ul> : <p>{points ? 'Chưa có giao dịch xu.' : 'Đang tải…'}</p>}</section>
  </main>;
}
