import { geocodeGoogle } from '../utils/googleMaps';
import { useCallback, useState } from 'react';

export function useCurrentLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const getCurrentLocation = useCallback(({ resolveAddress = true } = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { const message = 'Trình duyệt không hỗ trợ định vị.'; setError(message); reject(new Error(message)); return; }
      setLoading(true); setError('');
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude, address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` };
        try {
          if (resolveAddress) {
          const rows = await geocodeGoogle(point); point.address = rows[0]?.display_name || point.address;
          }
        } catch { /* Vẫn dùng được tọa độ thật nếu reverse geocode lỗi. */ }
        setLoading(false); resolve(point);
      }, (positionError) => {
        const message = positionError.code === positionError.PERMISSION_DENIED ? 'Bạn cần cho phép truy cập vị trí để dùng tính năng này.' : 'Không thể lấy vị trí hiện tại, vui lòng nhập thủ công.';
        setLoading(false); setError(message); reject(new Error(message));
      }, { enableHighAccuracy: true, timeout: 10000 });
    });
  }, []);
  return { getCurrentLocation, loading, error };
}
