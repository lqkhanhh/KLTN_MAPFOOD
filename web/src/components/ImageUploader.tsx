import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

interface Props { value?: string | null; onChange: (url: string) => void; label?: string; disabled?: boolean; onBusyChange?: (busy: boolean) => void }
const validUrl = (value: string) => /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)?$/.test(value);
export function ImageUploader({ value, onChange, label = 'Ảnh', disabled = false, onBusyChange }: Props) {
  const id = useId(); const [uploading, setUploading] = useState(false); const [preview, setPreview] = useState(''); const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null); const localUrl = useRef(''); const mounted = useRef(true); const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const config = (window as any).ROUTEBITE_CONFIG || {};
  const cloud = String(config.cloudinaryCloudName || '').trim(); const preset = String(config.cloudinaryUploadPreset || '').trim();
  const configured = /^[a-zA-Z0-9_-]+$/.test(cloud) && !!preset;
  useEffect(() => () => { mounted.current = false; abort.current?.abort(); if (localUrl.current) URL.revokeObjectURL(localUrl.current); if (abort.current) busyCallback.current?.(false); }, []);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || uploading || disabled) return;
    setError('');
    if (!configured) { setError('Chưa cấu hình Cloudinary. Bạn có thể nhập URL ảnh bên dưới.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.'); return; }
    const controller = new AbortController(); abort.current = controller;
    localUrl.current = URL.createObjectURL(file); setPreview(localUrl.current); setUploading(true); busyCallback.current?.(true);
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const data = new FormData(); data.append('file', file); data.append('upload_preset', preset);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: 'POST', body: data, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || typeof result.secure_url !== 'string' || !result.secure_url.startsWith('https://')) throw new Error();
      if (mounted.current) onChange(result.secure_url);
    } catch { if (mounted.current) setError('Tải ảnh thất bại. Kiểm tra kết nối hoặc unsigned preset rồi thử lại; ảnh đã lưu được giữ nguyên.'); }
    finally {
      clearTimeout(timer); URL.revokeObjectURL(localUrl.current); localUrl.current = ''; abort.current = null;
      if (mounted.current) { setPreview(''); setUploading(false); busyCallback.current?.(false); }
    }
  }
  const image = preview || (value && validUrl(value) ? value : '');
  return <div className="rb-image-uploader" role="group" aria-label={label}>
    <span className="rb-image-label">{label}</span><div className="rb-image-controls">
      <img src={image || '/placeholder-food.svg'} alt={`Xem trước ${label.toLowerCase()}`} onError={(event) => { if (event.currentTarget.getAttribute('src') !== '/placeholder-food.svg') event.currentTarget.src = '/placeholder-food.svg'; }} />
      <div><label htmlFor={id} className="rb-image-file-label">{uploading ? 'Đang tải lên…' : 'Chọn ảnh'}</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Chọn ${label.toLowerCase()}`} disabled={disabled || uploading || !configured} onChange={upload} />
        {value && <button className="rb-danger-button" type="button" disabled={disabled || uploading} onClick={() => { onChange(''); setError(''); }}>Bỏ ảnh</button>}
      </div></div>
    {!configured && <small>Chưa cấu hình Cloudinary — có thể nhập URL ảnh.</small>}
    <label>URL ảnh<input aria-label={`URL ${label.toLowerCase()}`} value={value || ''} placeholder="https://…" disabled={disabled || uploading} onChange={(event) => { onChange(event.target.value); setError(validUrl(event.target.value) ? '' : 'URL ảnh phải bắt đầu bằng http:// hoặc https://.'); }} /></label>
    {error && <small role="alert">{error}</small>}
  </div>;
}
