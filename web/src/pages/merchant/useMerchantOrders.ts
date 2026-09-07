import { useEffect, useRef, useState } from 'react';
import { request } from '../../api';
import { useSockets } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

export function useMerchantOrders(restaurantId?: string) {
  const { currentUser } = useAuth(); const { orders: socket } = useSockets();
  const [orders, setOrders] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true; let sequence = 0;
    setOrders([]); setLoading(!!restaurantId); setError('');
    const refresh = async () => {
      if (!restaurantId) return;
      const version = ++sequence;
      try { const data = await request(`/orders?restaurantId=${encodeURIComponent(restaurantId)}`);
        if (active && version === sequence) { setOrders(Array.isArray(data) ? data : data.data || []); setError(''); }
      } catch (e: any) { if (active && version === sequence) setError(e.message); }
      finally { if (active && version === sequence) setLoading(false); }
    };
    refreshRef.current = refresh;
    const connect = () => { socket?.emit('merchant.subscribe', { merchantId: currentUser.id }); void refresh(); };
    void refresh(); if (socket?.connected) connect();
    socket?.on('connect', connect); socket?.on('order.created', refresh); socket?.on('order.status.updated', refresh); socket?.on('payment.status.updated', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); socket?.off('connect', connect); socket?.off('order.created', refresh); socket?.off('order.status.updated', refresh); socket?.off('payment.status.updated', refresh); };
  }, [restaurantId, socket, currentUser.id]);
  return { orders, loading, error, refresh: () => refreshRef.current() };
}
