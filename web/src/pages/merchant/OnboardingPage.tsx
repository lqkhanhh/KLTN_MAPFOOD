import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../../api';
import { useMerchant } from '../../contexts/MerchantContext';
import { ImageUploader } from '../../components/ImageUploader';

export function OnboardingPage() {
  const { updateRestaurant } = useMerchant(); const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', address: '', category: 'com', latitude: '', longitude: '', openingHours: '08:00-22:00', imageUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [locating, setLocating] = useState(false);
  const field = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!form.name.trim() || !form.address.trim()) { setError('Vui lòng điền tên và địa chỉ quán.'); return; }
    setBusy(true); setError('');
    try {
      const result = await request('/restaurants', { method: 'POST', body: { ...form, name: form.name.trim(), address: form.address.trim(), latitude: Number(form.latitude), longitude: Number(form.longitude), active: true, menuItems: [] } });
      updateRestaurant(result); navigate('/merchant/menu', { replace: true });
    } catch (e: any) { setError(e.message || 'Không thể tạo quán.'); }
    finally { setBusy(false); }
  }
  function locate() {
    if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ định vị. Bạn có thể nhập tọa độ quán.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => { setForm((old) => ({ ...old, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) })); setLocating(false); },
      () => { setError('Không lấy được vị trí. Vui lòng cho phép định vị hoặc nhập tọa độ quán.'); setLocating(false); }, { timeout: 10000 });
  }
  return <section className="rb-onboarding"><p className="rb-eyebrow">BẮT ĐẦU BÁN HÀNG</p><h1>Đăng ký quán của bạn</h1><p>Tạo thông tin quán trước, sau đó thêm món ở trang Quản lý Menu.</p>
    {error && <p className="auth-alert" role="alert">{error}</p>}
    <form onSubmit={submit}><fieldset disabled={busy || uploading}>
      <ImageUploader label="Ảnh đại diện quán" value={form.imageUrl} onChange={(url) => field('imageUrl', url)} onBusyChange={setUploading} />
      <label>Tên quán<input required value={form.name} onChange={(e) => field('name', e.target.value)} /></label>
      <label>Địa chỉ quán<input required value={form.address} onChange={(e) => field('address', e.target.value)} /></label>
      <label>Danh mục<select value={form.category} onChange={(e) => field('category', e.target.value)}><option value="com">Cơm</option><option value="bun-pho">Bún/Phở</option><option value="ca-phe">Cà phê</option><option value="do-uong">Đồ uống</option><option value="an-vat">Ăn vặt</option></select></label>
      <label>Giờ mở cửa<input required value={form.openingHours} onChange={(e) => field('openingHours', e.target.value)} placeholder="08:00-22:00" /></label>
      <div className="rb-onboarding-coords"><label>Vĩ độ<input type="number" step="any" min="-90" max="90" required value={form.latitude} onChange={(e) => field('latitude', e.target.value)} /></label>
        <label>Kinh độ<input type="number" step="any" min="-180" max="180" required value={form.longitude} onChange={(e) => field('longitude', e.target.value)} /></label></div>
      <button className="btn secondary" type="button" disabled={locating} onClick={locate}>{locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại làm vị trí quán'}</button>
      <button className="btn primary" type="submit" disabled={locating}>{busy ? 'Đang tạo quán…' : 'Tạo quán và thêm món'}</button>
    </fieldset></form>
  </section>;
}
