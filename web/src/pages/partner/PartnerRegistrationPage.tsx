import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { request } from '../../api';
import { LoadError } from '../admin/AdminShared';
import { DOCUMENT_LABELS, downloadDocument, type PartnerApplication, type PartnerTerms } from './partnerData';

function PartnerAccount() {
  const { setSession } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (form.password !== form.confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true); setError('');
    try { const { confirmPassword, ...body } = form; setSession(await request('/auth/register', { method: 'POST', authorized: false, body })); }
    catch (error: any) { setError(error.message || 'Không thể tạo tài khoản.'); }
    finally { setBusy(false); }
  }
  return <section className="item-card rb-partner-account"><h2>Tạo tài khoản nộp hồ sơ</h2><p>Tài khoản chưa có quyền Merchant cho đến khi được Admin duyệt.</p>
    <p>Đã có tài khoản? <Link to="/login" state={{ from: '/partner/register' }}>Đăng nhập để tiếp tục</Link></p>
    {error && <p role="alert" className="auth-alert">{error}</p>}
    <form className="auth-form" onSubmit={submit}><fieldset disabled={busy}>
      {([{ key: 'fullName', label: 'Họ tên người đại diện', type: 'text' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' }, { key: 'password', label: 'Mật khẩu', type: 'password' }, { key: 'confirmPassword', label: 'Xác nhận mật khẩu', type: 'password' }] as const).map((field) => <label key={field.key}>{field.label}<input required minLength={field.type === 'password' ? 6 : undefined} type={field.type} value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /></label>)}
      <button className="btn primary" type="submit">{busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản và điền thông tin quán'}</button>
    </fieldset></form>
  </section>;
}

function PartnerForm() {
  const { logout } = useAuth(); const navigate = useNavigate();
  const [app, setApp] = useState<PartnerApplication | null>(null), [terms, setTerms] = useState<PartnerTerms | null>(null);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [revision, setRevision] = useState(0);
  const [step, setStep] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const [shop, setShop] = useState({ name: '', address: '', latitude: '', longitude: '', category: 'com', openingHours: '08:00-22:00' });
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [agree, setAgree] = useState({ accuracy: false, terms: false, documentReview: false });
  useEffect(() => {
    let current = true; setLoading(true); setLoadError('');
    Promise.all([request('/merchant-applications/me'), request('/merchant-applications/terms', { authorized: false })]).then(([data, policy]) => {
      if (!current) return;
      setApp(data); setTerms(policy); setAgree({ accuracy: false, terms: false, documentReview: false });
      if (data) { setShop({ ...data.shop, latitude: String(data.shop.latitude), longitude: String(data.shop.longitude) }); if (data.bank) setBank(data.bank); }
    }).catch((error) => { if (current) setLoadError(error.message || 'Không thể tải hồ sơ.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [revision]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await task(); } catch (error: any) { setError(error.message || 'Không thể lưu hồ sơ.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (loading) return <p role="status">Đang tải hồ sơ đối tác…</p>;
  if (loadError) return <LoadError error={loadError} retry={() => setRevision((value) => value + 1)} />;
  if (app?.status === 'SUBMITTED' || app?.status === 'APPROVED') return <section className="item-card rb-partner-status">
    <h2>{app.status === 'APPROVED' ? 'Hồ sơ đã được phê duyệt' : 'Hồ sơ đang chờ Admin duyệt'}</h2>
    <p>{app.shop.name}</p><p>{app.status === 'APPROVED' ? 'Đăng nhập lại để nhận quyền Merchant và quản lý quán đã đăng ký.' : 'Bạn chưa được cấp quyền Merchant. Có thể quay lại trang này để xem kết quả xét duyệt.'}</p>
    <p>Đã xác nhận điều khoản {app.termsVersion}. Chưa ký hợp đồng điện tử.</p>
    <div className="btn-row"><button className="btn secondary" onClick={() => setRevision((value) => value + 1)}>Kiểm tra trạng thái</button><button className="btn primary" onClick={() => { logout(); navigate('/login', { state: { from: '/partner/register' } }); }}>Đăng nhập lại</button></div>
  </section>;
  const completeDocs = app && Object.keys(DOCUMENT_LABELS).every((kind) => app.documents.some((doc) => doc.kind === kind));
  return <>
    <ol className="rb-partner-steps">{['Thông tin quán', 'Hồ sơ & ngân hàng', 'Điều khoản & xác nhận'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>
    {app?.status === 'REJECTED' && <p className="auth-alert" role="status">Admin yêu cầu bổ sung: {app.rejectionReason}. Chỉnh sửa và gửi lại hồ sơ bên dưới.</p>}
    {error && <p className="auth-alert" role="alert">{error}</p>}
    {step === 1 && <form className="item-card rb-partner-form" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const data = await request('/merchant-applications/me', { method: 'PUT', body: { shop: { ...shop, latitude: Number(shop.latitude), longitude: Number(shop.longitude) } } });
      setApp(data); setAgree({ accuracy: false, terms: false, documentReview: false }); setStep(2);
    }); }}><h2>1. Điền thông tin quán</h2><fieldset disabled={busy}>
      <label>Tên quán<input required minLength={2} maxLength={150} value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} /></label>
      <label>Địa chỉ quán<input required minLength={5} maxLength={300} value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} /></label>
      <div className="rb-partner-columns"><label>Danh mục<select value={shop.category} onChange={(e) => setShop({ ...shop, category: e.target.value })}>{[['com','Cơm'],['bun-pho','Bún/Phở'],['ca-phe','Cà phê'],['do-uong','Đồ uống'],['an-vat','Ăn vặt'],['khac','Khác']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Giờ mở cửa<input required minLength={3} maxLength={100} value={shop.openingHours} onChange={(e) => setShop({ ...shop, openingHours: e.target.value })} /></label></div>
      <div className="rb-partner-columns"><label>Vĩ độ quán<input required type="number" step="any" min={-90} max={90} value={shop.latitude} onChange={(e) => setShop({ ...shop, latitude: e.target.value })} /></label><label>Kinh độ quán<input required type="number" step="any" min={-180} max={180} value={shop.longitude} onChange={(e) => setShop({ ...shop, longitude: e.target.value })} /></label></div>
      <button className="btn secondary" type="button" onClick={() => void run(async () => {
        if (!navigator.geolocation) throw new Error('Trình duyệt không hỗ trợ định vị.');
        const result = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Không lấy được vị trí. Hãy cho phép định vị hoặc nhập tọa độ.')), { timeout: 10000 }));
        setShop({ ...shop, latitude: String(result.coords.latitude), longitude: String(result.coords.longitude) });
      })}>Dùng vị trí hiện tại của quán</button>
      <button className="btn primary" type="submit">{busy ? 'Đang lưu…' : 'Lưu và tiếp tục'}</button>
    </fieldset></form>}
    {step === 2 && <section className="item-card rb-partner-form"><h2>2. Nộp hồ sơ và tài khoản ngân hàng</h2><p>JPG, PNG hoặc PDF, tối đa 5 MB/tài liệu. Không tải hồ sơ lên dịch vụ ảnh công khai.</p>
      <fieldset disabled={busy}>{Object.entries(DOCUMENT_LABELS).map(([kind, label]) => {
        const doc = app?.documents.find((item) => item.kind === kind);
        return <div className="rb-partner-document" key={kind}><label>{label}<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          void run(async () => {
            if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) throw new Error('Chọn JPG, PNG hoặc PDF tối đa 5 MB.');
            const body = new FormData(); body.append('file', file);
            setApp(await request(`/merchant-applications/me/documents/${kind}`, { method: 'POST', body }));
          });
        }} /></label><span>{doc ? 'Đã lưu tài liệu' : 'Chưa có tài liệu'}</span>{doc && <button type="button" className="btn secondary" onClick={() => void run(() => downloadDocument(app!, doc))}>Tải {label}</button>}</div>;
      })}</fieldset>
      <form onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!completeDocs) throw new Error('Vui lòng tải đủ bốn tài liệu trước khi tiếp tục.'); setApp(await request('/merchant-applications/me/bank', { method: 'PUT', body: bank })); setStep(3); }); }}><fieldset disabled={busy}>
        <label>Ngân hàng<input required minLength={2} maxLength={100} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} /></label>
        <label>Số tài khoản<input required inputMode="numeric" pattern="[0-9]{6,30}" autoComplete="off" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} /></label>
        <label>Chủ tài khoản<input required minLength={2} maxLength={120} autoComplete="off" value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} /></label>
        <div className="btn-row"><button type="button" className="btn secondary" onClick={() => setStep(1)}>Quay lại</button><button className="btn primary" type="submit">Lưu hồ sơ và đọc điều khoản</button></div>
      </fieldset></form>
    </section>}
    {step === 3 && terms && <section className="item-card rb-partner-form"><h2>3. {terms.title}</h2><p className="rb-partner-notice">{terms.notice}</p>
      <div className="rb-partner-terms">{terms.sections.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void run(async () => { setApp(await request('/merchant-applications/me/submit', { method: 'POST', body: { termsVersion: terms.version, agreements: agree } })); }); }}>
        <fieldset disabled={busy} className="rb-partner-agreements">
          <label><input type="checkbox" required checked={agree.accuracy} onChange={(e) => setAgree({ ...agree, accuracy: e.target.checked })} />Tôi xác nhận thông tin và hồ sơ đã cung cấp là chính xác, tôi có quyền cung cấp các giấy tờ này.</label>
          <label><input type="checkbox" required checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />Tôi đã đọc và đồng ý với điều khoản đăng ký đối tác nêu trên.</label>
          <label><input type="checkbox" required checked={agree.documentReview} onChange={(e) => setAgree({ ...agree, documentReview: e.target.checked })} />Tôi đồng ý cung cấp hồ sơ cho RouteBite để xét duyệt và hiểu rằng quyền Merchant chỉ được cấp khi Admin phê duyệt.</label>
          <p>Phiên bản: {terms.version}. Thời điểm xác nhận được lưu khi bạn gửi hồ sơ.</p>
          <div className="btn-row"><button type="button" className="btn secondary" onClick={() => setStep(2)}>Quay lại</button><button type="submit" className="btn primary" disabled={!Object.values(agree).every(Boolean)}>Gửi hồ sơ cho Admin duyệt</button></div>
        </fieldset>
      </form>
    </section>}
    {busy && <p role="status">Đang xử lý, vui lòng chờ…</p>}
  </>;
}

export function PartnerRegistrationPage() {
  const { currentUser } = useAuth();
  if (currentUser?.role === 'merchant') return <Navigate to="/merchant/dashboard" replace />;
  if (currentUser?.role === 'admin') return <Navigate to="/admin/merchant-applications" replace />;
  return <main className="app-page rb-partner-page"><Link to="/login">← Trang đăng nhập</Link><header className="rb-admin-heading"><p>ĐỒNG HÀNH CÙNG ROUTEBITE</p><h1>Đăng ký đối tác Merchant</h1><span>Thông tin quán → Hồ sơ → Xác nhận điều khoản → Admin xét duyệt.</span></header>{currentUser ? <PartnerForm /> : <PartnerAccount />}</main>;
}
