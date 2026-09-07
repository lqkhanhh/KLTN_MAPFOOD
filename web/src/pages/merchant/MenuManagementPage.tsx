import { useEffect, useState } from 'react';
import { request } from '../../api';
import { useMerchant } from '../../contexts/MerchantContext';
import { MerchantRestaurant, restaurantPayload } from './types';
import { ImageUploader } from '../../components/ImageUploader';

const clean = (items: any[]) => items.map((item) => ({ ...(item.id ? { id: item.id } : {}), name: item.name, price: Number(item.price), description: item.description || '', available: item.available !== false, imageUrl: item.imageUrl || '' }));
export function MenuManagementPage() {
  const { restaurant } = useMerchant();
  return restaurant ? <MenuEditor key={restaurant.id} restaurant={restaurant} /> : null;
}
function MenuEditor({ restaurant }: { restaurant: MerchantRestaurant }) {
  const { updateRestaurant, setDirty, saving, setSaving } = useMerchant();
  const [baseline, setBaseline] = useState<any[]>(() => clean(restaurant.menuItems || []));
  const [draft, setDraft] = useState<any[]>(() => clean(restaurant.menuItems || []));
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty, setDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(index: number, field: string, value: unknown) { setDraft((old) => old.map((item, i) => i === index ? { ...item, [field]: value } : item)); setMessage(''); }
  async function save() {
    if (saving) return;
    if (draft.some((item) => !item.name.trim() || item.name.length > 160 || item.price === '' || !Number.isSafeInteger(Number(item.price)) || Number(item.price) < 0 || Number(item.price) > 99999999999999)) {
      setError('Điền tên món (tối đa 160 ký tự) và giá nguyên không âm hợp lệ.'); return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await request('/restaurants/' + restaurant.id, { method: 'PUT', body: restaurantPayload(restaurant, draft) });
      const items = clean(result.menuItems || []); setBaseline(items); setDraft(items); updateRestaurant(result); setMessage('Đã lưu menu thành công.');
    } catch (e: any) { setError(e.message || 'Không thể lưu menu.'); }
    finally { setSaving(false); }
  }
  async function toggle(index: number) {
    if (saving) return;
    const item = draft[index];
    if (!item.id) { update(index, 'available', !item.available); return; }
    const available = !item.available;
    // Chỉ gửi trạng thái món từ bản đã lưu, không gửi kèm tên/giá đang sửa dở.
    const items = baseline.map((entry) => entry.id === item.id ? { ...entry, available } : entry);
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await request('/restaurants/' + restaurant.id, { method: 'PUT', body: restaurantPayload(restaurant, items) });
      setBaseline(clean(result.menuItems || []));
      setDraft((old) => old.map((entry) => entry.id === item.id ? { ...entry, available } : entry));
      updateRestaurant(result); setMessage('Đã cập nhật trạng thái bán. Các chỉnh sửa khác vẫn chưa được lưu.');
    } catch (e: any) { setError(e.message || 'Không thể cập nhật trạng thái bán.'); }
    finally { setSaving(false); }
  }
  return <section>
    <div className="rb-merchant-page-head"><div><p className="rb-eyebrow">QUÁN CỦA BẠN</p><h1>Quản lý Menu</h1><p>{restaurant.name}</p></div>
      <button className="btn primary" type="button" disabled={saving} onClick={() => setDraft((old) => [...old, { name: '', price: '', description: '', available: true }])}>+ Thêm món mới</button></div>
    <p className="rb-merchant-hint">Thêm, sửa, xóa món rồi bấm Lưu thay đổi. Còn hàng/Hết hàng của món đã có sẽ được lưu ngay.</p>
    {error && <p className="auth-alert" role="alert">{error}</p>}{message && <p role="status" className="rb-merchant-feedback">{message}</p>}
    <fieldset disabled={saving} className="rb-menu-editor">
      {draft.map((item, index) => <div key={item.id || `new-${index}`} className="rb-menu-edit-row">
        <ImageUploader label={`Ảnh món ${index + 1}`} value={item.imageUrl} onChange={(url) => update(index, 'imageUrl', url)} disabled={saving} onBusyChange={setSaving} />
        <label>Tên món<input aria-label={`Tên món ${index + 1}`} maxLength={160} value={item.name} onChange={(event) => update(index, 'name', event.target.value)} placeholder="Tên món" /></label>
        <label>Giá (đ)<input aria-label={`Giá món ${index + 1}`} type="number" min="0" max="99999999999999" step="1" value={item.price} onChange={(event) => update(index, 'price', event.target.value === '' ? '' : Number(event.target.value))} /></label>
        <label>Mô tả<input aria-label={`Mô tả món ${index + 1}`} value={item.description} onChange={(event) => update(index, 'description', event.target.value)} /></label>
        <button className={`rb-stock-toggle ${item.available ? 'available' : ''}`} type="button" aria-label={`Trạng thái ${item.name || 'món mới'}`} aria-pressed={item.available} onClick={() => toggle(index)}>{item.available ? 'Còn hàng' : 'Hết hàng'}</button>
        <button type="button" className="rb-danger-button" aria-label={`Xóa ${item.name || 'món mới'}`} onClick={() => setDraft((old) => old.filter((_, i) => i !== index))}>Xóa</button>
      </div>)}
      {!draft.length && <p className="rb-empty">Chưa có món nào, bấm “Thêm món mới” để bắt đầu.</p>}
    </fieldset>
    {dirty && <div className="rb-menu-save-bar"><span>Có thay đổi chưa lưu</span><button type="button" className="btn secondary" disabled={saving} onClick={() => { if (window.confirm('Bỏ các thay đổi menu chưa lưu?')) setDraft(baseline); }}>Bỏ thay đổi</button>
      <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>}
  </section>;
}
