import { useRef, useState } from 'react';

export function ShareRestaurantButton({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const pending = useRef(false);
  // Chỉ chia sẻ đường dẫn quán, không đưa tọa độ xuất phát hay thông tin giỏ hàng vào liên kết.
  const url = new URL(`/restaurant/${encodeURIComponent(restaurantId)}`, window.location.origin).href;
  async function share() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(''); setManualCopy(false);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: restaurantName, text: `Xem menu ${restaurantName} trên RouteBite`, url });
          return;
        } catch (error: any) {
          if (error?.name === 'AbortError') return; // Người dùng đóng hộp chia sẻ, không tự sao chép.
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setMessage('Đã sao chép liên kết quán.');
      } catch {
        setManualCopy(true); setMessage('Bạn có thể chọn và sao chép liên kết bên dưới.');
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <div className="rb-share-restaurant">
    <button type="button" className="btn secondary" onClick={share} disabled={busy}>{busy ? 'Đang chia sẻ…' : 'Chia sẻ'}</button>
    {message && <p role="status">{message}</p>}
    {manualCopy && <input aria-label="Liên kết chia sẻ quán" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />}
  </div>;
}
