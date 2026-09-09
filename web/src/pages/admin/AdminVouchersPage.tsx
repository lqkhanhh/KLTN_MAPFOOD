import { useEffect, useRef, useState } from 'react';
import { request } from '../../api';
import { Voucher, voucherTerms } from '../../loyalty';

export function AdminVouchersPage() {
  const [rows, setRows] = useState<Voucher[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [form, setForm] = useState({ code: '', title: '', discountType: 'fixed', discountValue: 10000, minOrderAmount: 100000 });
  async function load() { try { setRows(await request('/admin/vouchers')); setError(''); } catch (e) { setError(e.message); } }
  useEffect(() => { void load(); }, []);
  async function mutate(path: string, method: string, body: object) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await request(path, { method, body }); await load(); }
    catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="rb-loyalty-page"><header className="page-intro"><p className="rb-eyebrow">QUẢN TRỊ ƯU ĐÃI</p><h1>Voucher</h1></header>
    <p>Phát hành voucher miễn phí cho khách hàng. Bảng đổi xu cố định được quản lý riêng; không sửa giá trị voucher đã phát hành.</p>
    {error && <p role="alert">{error} <button className="btn secondary" onClick={load} disabled={busy}>Thử lại</button></p>}
    <form className="item-card rb-voucher-form" onSubmit={(event) => { event.preventDefault(); void mutate('/admin/vouchers', 'POST', form); }}>
      <label>Mã voucher<input required pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} value={form.code} disabled={busy} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
      <label>Tên ưu đãi<input required maxLength={160} value={form.title} disabled={busy} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Loại giảm<select value={form.discountType} disabled={busy} onChange={(e) => setForm({ ...form, discountType: e.target.value, discountValue: e.target.value === 'percent' ? 10 : 10000 })}><option value="fixed">Số tiền (đ)</option><option value="percent">Phần trăm (%)</option></select></label>
      <label>Giá trị giảm<input required type="number" min={1} max={form.discountType === 'percent' ? 100 : 1000000000} step={1} disabled={busy} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} /></label>
      <label>Đơn tối thiểu (đ)<input required type="number" min={0} max={99999999999999} step={1} disabled={busy} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} /></label>
      <button className="btn primary" disabled={busy}>Phát hành voucher miễn phí</button>
    </form><h2>Danh sách voucher</h2><div className="rb-voucher-grid">{rows.map((v) => <article className="item-card" key={v.id}><h3>{v.title}</h3><code>{v.code}</code><p>{voucherTerms(v)}</p><p>{v.pointsCost === null ? 'Nhận miễn phí' : `${v.pointsCost} xu`} · {v.active ? 'Đang hoạt động' : 'Đã tắt'}</p>
      <button className="btn secondary" disabled={busy} onClick={() => mutate(`/admin/vouchers/${v.id}`, 'PATCH', { active: !v.active })}>{v.active ? 'Ngừng hoạt động' : 'Kích hoạt'}</button></article>)}</div>
  </section>;
}
