import { useEffect, useRef, useState } from 'react';
import { request } from '../../api';
import { LoadError, Pagination } from './AdminShared';
import { useAdminData, type AdminRestaurant, type PageData } from './adminData';

const SOURCE_LABELS: Record<string, string> = { osm_import: 'Nhập từ OSM', merchant: 'Chủ quán', manual: 'Nhập thủ công', demo: 'Dữ liệu mẫu' };

export function AdminRestaurantsPage() {
  const [page, setPage] = useState(1);
  const resource = useAdminData<PageData<AdminRestaurant>>(`/admin/restaurants?page=${page}&limit=20`);
  const [target, setTarget] = useState<AdminRestaurant | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (target) dialog.current?.showModal(); }, [target]);
  const close = () => { if (!inFlight.current) { dialog.current?.close(); setTarget(null); setReason(''); setError(''); } };

  async function update(shop: AdminRestaurant, action: 'suspend' | 'activate') {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (action === 'suspend' && (trimmed.length < 5 || trimmed.length > 500)) { setError('Lý do tạm ngưng phải có từ 5 đến 500 ký tự.'); return; }
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await request(`/admin/restaurants/${shop.id}/${action}`, { method: 'PATCH', ...(action === 'suspend' ? { body: { reason: trimmed } } : {}) });
      dialog.current?.close(); setTarget(null); setReason('');
      setMessage(action === 'suspend' ? `Đã tạm ngưng quán “${shop.name}”.` : `Đã kích hoạt lại quán “${shop.name}”.`);
      resource.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Không thể cập nhật quán. Vui lòng thử lại.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <>
    <header className="rb-admin-heading"><p>QUẢN TRỊ HỆ THỐNG</p><h1>Quản lý quán ăn</h1><span>Theo dõi nguồn dữ liệu và trạng thái hoạt động của các quán.</span></header>
    {message && <p className="rb-merchant-feedback" role="status">{message}</p>}
    {error && !target && <p className="rb-admin-error" role="alert">{error}</p>}
    {resource.loading ? <p role="status">Đang tải quán ăn…</p> : resource.error ? <LoadError error={resource.error} retry={resource.refresh} /> : resource.data && <>
      {resource.data.data.length ? <div className="item-card rb-admin-table-wrap" tabIndex={0} aria-label="Danh sách quán ăn"><table><thead><tr><th>Tên quán</th><th>Nguồn</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{resource.data.data.map((shop) => <tr key={shop.id}>
        <td><strong>{shop.name}</strong>{shop.owner && <small>{shop.owner.fullName || shop.owner.email}</small>}</td>
        <td>{SOURCE_LABELS[shop.source || ''] || shop.source || 'Chưa xác định'}</td>
        <td><span className={`rb-admin-status ${shop.active ? 'active' : ''}`}>{shop.active ? 'Đang hoạt động' : 'Tạm ngưng'}</span>{!shop.active && <small>{shop.suspendedReason || 'Chưa có lý do tạm ngưng được lưu.'}</small>}</td>
        <td><button type="button" className={`btn secondary ${shop.active ? 'rb-admin-danger' : ''}`} disabled={busy} onClick={() => {
          if (shop.active) { setTarget(shop); setReason(''); setError(''); }
          else void update(shop, 'activate');
        }}>{shop.active ? 'Tạm ngưng' : 'Kích hoạt lại'}</button></td>
      </tr>)}</tbody></table></div> : <section className="item-card">Chưa có quán ăn.</section>}
      <Pagination page={page} total={resource.data.total} limit={20} onPage={setPage} disabled={busy} />
    </>}
    {target && <dialog className="rb-admin-dialog" ref={dialog} aria-labelledby="suspend-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <form onSubmit={(event) => { event.preventDefault(); void update(target, 'suspend'); }}>
        <h2 id="suspend-title">Tạm ngưng “{target.name}”</h2><p>Quán sẽ không còn xuất hiện trong danh sách công khai và kết quả tìm kiếm.</p>
        <label htmlFor="suspend-reason">Lý do tạm ngưng (bắt buộc)</label>
        <textarea id="suspend-reason" autoFocus rows={4} maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} aria-describedby="suspend-hint" />
        <small id="suspend-hint">Từ 5 đến 500 ký tự · {reason.trim().length}/500</small>
        {error && <p role="alert" className="rb-admin-error">{error}</p>}
        <div className="rb-admin-dialog-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>Hủy</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Xác nhận tạm ngưng'}</button></div>
      </form>
    </dialog>}
  </>;
}
