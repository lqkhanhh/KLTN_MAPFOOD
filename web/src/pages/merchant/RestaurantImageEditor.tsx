import { useEffect, useState } from 'react';
import { ImageUploader } from '../../components/ImageUploader';
import { useMerchant } from '../../contexts/MerchantContext';
import { request } from '../../api';
import { MerchantRestaurant, restaurantPayload } from './types';

export function RestaurantImageEditor({ restaurant }: { restaurant: MerchantRestaurant }) {
  const { saving, setSaving, setDirty, updateRestaurant } = useMerchant();
  const [imageUrl, setImageUrl] = useState(restaurant.imageUrl || ''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const dirty = imageUrl !== (restaurant.imageUrl || '');
  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty, setDirty]);
  async function save() {
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await request('/restaurants/' + restaurant.id, { method: 'PUT', body: { ...restaurantPayload(restaurant, restaurant.menuItems), imageUrl } });
      updateRestaurant(result); setMessage('Đã lưu ảnh đại diện quán.');
    } catch (e: any) { setError(e.message || 'Không thể lưu ảnh quán.'); }
    finally { setSaving(false); }
  }
  return <section className="item-card rb-restaurant-image-editor">
    <ImageUploader label="Ảnh đại diện quán" value={imageUrl} onChange={setImageUrl} disabled={saving} onBusyChange={setSaving} />
    {error && <p className="auth-alert" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="btn primary" type="button" disabled={saving || !dirty} onClick={save}>{saving ? 'Đang xử lý…' : 'Lưu ảnh quán'}</button>
  </section>;
}
