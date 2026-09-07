import { useState } from 'react';
import { request } from '../../api';
import { LoadError, Pagination } from './AdminShared';
import { useAdminData, type PageData } from './adminData';
import { APPLICATION_LABELS, DOCUMENT_LABELS, downloadDocument, type PartnerApplication } from '../partner/partnerData';

function ApplicationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const data = useAdminData<PartnerApplication>('/admin/merchant-applications/' + id);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const app = data.data;
  async function review(approve: boolean) {
    if (busy) return;
    if (!approve && reason.trim().length < 5) { setError('Nhập lý do từ chối từ 5 đến 500 ký tự.'); return; }
    if (approve && !window.confirm('Duyệt hồ sơ, cấp quyền Merchant và tạo quán cho tài khoản này?')) return;
    setBusy(true); setError('');
    try { await request(`/admin/merchant-applications/${id}/${approve ? 'approve' : 'reject'}`, { method: 'PATCH', ...(approve ? {} : { body: { reason: reason.trim() } }) }); data.refresh(); }
    catch (error: any) { setError(error.message || 'Không thể xét duyệt hồ sơ.'); }
    finally { setBusy(false); }
  }
  return <><button className="btn secondary" disabled={busy} onClick={onBack}>← Danh sách hồ sơ</button>
    {data.loading ? <p role="status">Đang tải hồ sơ…</p> : data.error ? <LoadError error={data.error} retry={data.refresh} /> : app && <section className="item-card rb-partner-form">
      <h2>{app.shop.name}</h2><p><strong>{APPLICATION_LABELS[app.status]}</strong></p>
      <dl className="rb-admin-summary"><div><dt>Người đại diện</dt><dd>{app.user.fullName}</dd></div><div><dt>Email</dt><dd>{app.user.email}</dd></div><div><dt>Số điện thoại</dt><dd>{app.user.phone || 'Chưa cập nhật'}</dd></div><div><dt>Địa chỉ quán</dt><dd>{app.shop.address}</dd></div><div><dt>Vị trí</dt><dd>{app.shop.latitude}, {app.shop.longitude}</dd></div><div><dt>Giờ mở cửa</dt><dd>{app.shop.openingHours}</dd></div></dl>
      <h3>Tài khoản ngân hàng</h3>{app.bank ? <dl className="rb-admin-summary"><div><dt>Ngân hàng</dt><dd>{app.bank.bankName}</dd></div><div><dt>Số tài khoản</dt><dd>{app.bank.accountNumber}</dd></div><div><dt>Chủ tài khoản</dt><dd>{app.bank.accountHolder}</dd></div></dl> : <p>Chưa bổ sung thông tin ngân hàng.</p>}
      <h3>Giấy tờ đã nộp</h3><p>Chỉ tải xuống để phục vụ xét duyệt. Không chia sẻ hồ sơ cá nhân ra ngoài hệ thống.</p>
      <div className="btn-row">{app.documents.map((doc) => <button type="button" className="btn secondary" key={doc.id} disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await downloadDocument(app, doc); } catch (error: any) { setError(error.message); } finally { setBusy(false); } }}>Tải {DOCUMENT_LABELS[doc.kind]}</button>)}</div>
      <h3>Xác nhận của người đăng ký</h3><p>{app.acceptedAt ? `Đã xác nhận lúc ${new Date(app.acceptedAt).toLocaleString('vi-VN')} · ${app.termsVersion}` : 'Chưa xác nhận điều khoản.'}</p>
      <ul><li>Thông tin chính xác: {app.agreements?.accuracy ? 'Đã xác nhận' : 'Chưa xác nhận'}</li><li>Đồng ý điều khoản: {app.agreements?.terms ? 'Đã xác nhận' : 'Chưa xác nhận'}</li><li>Đồng ý cung cấp hồ sơ xét duyệt: {app.agreements?.documentReview ? 'Đã xác nhận' : 'Chưa xác nhận'}</li></ul>
      <p className="rb-partner-notice">Đây là xác nhận điều khoản tạm thời, không phải hợp đồng đã ký điện tử.</p>
      {app.rejectionReason && <p>Lý do từ chối: {app.rejectionReason}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {app.status === 'SUBMITTED' && <fieldset disabled={busy} className="rb-partner-agreements"><label><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Tôi đã kiểm tra thông tin quán, giấy tờ và các xác nhận của người đăng ký.</label>
        <button className="btn primary" disabled={!checked} onClick={() => review(true)}>Duyệt và cấp quyền Merchant</button>
        <label className="rb-partner-reason">Lý do từ chối / yêu cầu bổ sung<textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button className="btn secondary rb-admin-danger" onClick={() => review(false)}>Từ chối và yêu cầu bổ sung</button>
      </fieldset>}
    </section>}
  </>;
}

export function AdminMerchantApplicationsPage() {
  const [status, setStatus] = useState('SUBMITTED'), [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null);
  const resource = useAdminData<PageData<PartnerApplication>>(`/admin/merchant-applications?page=${page}&limit=20${status ? '&status=' + status : ''}`);
  return <><header className="rb-admin-heading"><p>QUẢN TRỊ HỆ THỐNG</p><h1>Hồ sơ đối tác Merchant</h1><span>Kiểm tra hồ sơ trước khi cấp quyền quản lý quán.</span></header>
    {selected ? <ApplicationDetail id={selected} onBack={() => { setSelected(null); resource.refresh(); }} /> : <>
      <div className="rb-admin-filters" role="group" aria-label="Lọc trạng thái hồ sơ">{[['','Tất cả'],...Object.entries(APPLICATION_LABELS)].map(([value,label]) => <button aria-pressed={status === value} key={value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
      {resource.loading ? <p role="status">Đang tải hồ sơ…</p> : resource.error ? <LoadError error={resource.error} retry={resource.refresh} /> : resource.data && <>
        {resource.data.data.length ? <div className="item-card rb-admin-table-wrap" tabIndex={0}><table><thead><tr><th>Quán đăng ký</th><th>Người đăng ký</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{resource.data.data.map((app) => <tr key={app.id}><td>{app.shop.name}</td><td>{app.user.fullName}<small>{app.user.email}</small></td><td>{APPLICATION_LABELS[app.status]}</td><td><button className="btn secondary" onClick={() => setSelected(app.id)}>Xem hồ sơ</button></td></tr>)}</tbody></table></div> : <section className="item-card">Không có hồ sơ ở trạng thái này.</section>}
        <Pagination page={page} total={resource.data.total} limit={20} onPage={setPage} />
      </>}
    </>}
  </>;
}
