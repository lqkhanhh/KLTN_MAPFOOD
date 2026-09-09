import { useEffect, useState } from 'react';
import { request } from '../api';

// Không dùng snapshot giỏ hàng hay menu mẫu để quyết định quán có đang bán không.
export function usePublicRestaurant(id, enabled = true) {
  const [state, setState] = useState({ id: null, restaurant: null, error: '', loading: true });
  useEffect(() => {
    let active = true;
    let pending = false;
    setState({ id, restaurant: null, error: '', loading: enabled });
    if (!enabled) return;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const restaurant = await request('/restaurants/' + encodeURIComponent(id), { authorized: false });
        if (restaurant.active === false || restaurant.suspendedAt != null || restaurant.suspendedReason != null) {
          throw new Error('Quán đang tạm ngưng hoạt động, không thể xem menu hoặc đặt món.');
        }
        if (active) setState({ id, restaurant, error: '', loading: false });
      } catch (error) {
        if (active) setState({ id, restaurant: null, error: error.message || 'Không thể kiểm tra trạng thái quán.', loading: false });
      } finally { pending = false; }
    }
    function onVisible() { if (document.visibilityState === 'visible') void refresh(); }
    void refresh();
    const timer = window.setInterval(onVisible, 15000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, enabled]);
  return state.id === id ? state : { restaurant: null, error: '', loading: enabled };
}
