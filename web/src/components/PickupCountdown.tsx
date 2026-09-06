import { useEffect, useState } from 'react';

export function PickupCountdown({ estimatedPickupAt, pickupType }: {
  estimatedPickupAt?: string;
  pickupType: 'asap' | 'scheduled';
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [estimatedPickupAt]);

  const target = estimatedPickupAt ? new Date(estimatedPickupAt).getTime() : NaN;
  if (!Number.isFinite(target)) return null;
  if (pickupType === 'scheduled') {
    const time = new Date(target).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return <span>Hẹn lấy lúc {time}</span>;
  }
  // Làm tròn lên: còn vài giây vẫn hiển thị 1 phút, không dùng số phút lúc tạo đơn.
  const remainingMinutes = Math.max(0, Math.ceil((target - now) / 60_000));
  return remainingMinutes > 0
    ? <span>Lấy sau khoảng {remainingMinutes} phút</span>
    : <span className="rb-pickup-due">Có thể đã sẵn sàng, ghé lấy nhé!</span>;
}
