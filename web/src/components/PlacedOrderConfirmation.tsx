import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api';
import { useSockets } from '../contexts/SocketContext';
import { OrderStatusStepper } from './OrderStatusStepper';
import { PickupCountdown } from './PickupCountdown';

interface PlacedOrder {
  id: string; orderCode: string; status: string; paymentStatus: string; paymentMethod: string;
  totalAmount: number; estimatedPickupAt?: string; pickupType: 'asap' | 'scheduled'; updatedAt?: string;
}
type OrderEvent = Partial<PlacedOrder> & { orderId: string };

export function PlacedOrderConfirmation({ initialOrder }: { initialOrder: PlacedOrder }) {
  const { orders: socket } = useSockets();
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true, requestSequence = 0;
    const merge = (next: Partial<PlacedOrder>) => {
      if (!alive) return;
      setOrder((prev) => {
        // Bỏ phản hồi cũ đến muộn để bước tiến độ không bị lùi sau một sự kiện mới.
        const before = Date.parse(prev.updatedAt || ''), after = Date.parse(next.updatedAt || '');
        if (Number.isFinite(before) && Number.isFinite(after) && after < before) return prev;
        return { ...prev, ...next };
      });
    };
    const refresh = async () => {
      const sequence = ++requestSequence;
      try {
        const fresh = await request('/orders/' + initialOrder.id);
        if (!alive || sequence !== requestSequence || fresh?.id !== initialOrder.id) return;
        merge(fresh); setError(''); setUnavailable(false);
      } catch (e) {
        if (!alive || sequence !== requestSequence) return;
        setUnavailable([401, 403, 404].includes(e.status));
        setError('Chưa cập nhật được đơn hàng. Vui lòng thử lại.');
      }
    };
    const event = (payload: OrderEvent) => {
      if (!alive || payload?.orderId !== initialOrder.id) return;
      const { orderId, ...data } = payload;
      merge(data); void refresh();
    };
    const subscribe = () => {
      if (!alive) return;
      socket.emit('order.subscribe', { orderId: initialOrder.id }, (ack: { ok: boolean; payload?: OrderEvent }) => {
        if (!alive) return;
        setConnected(ack?.ok === true);
        // Đọc lại sau khi vào room để không bỏ sót thay đổi giữa lúc POST và subscribe.
        if (ack?.payload) event(ack.payload); else void refresh();
      });
    };
    const disconnected = () => { if (alive) setConnected(false); };
    const focus = () => { void refresh(); };
    setConnected(false); void refresh();
    socket?.on('connect', subscribe); socket?.on('disconnect', disconnected);
    socket?.on('order.status.updated', event); socket?.on('payment.status.updated', event);
    if (socket?.connected) subscribe();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', focus);
    return () => {
      alive = false; clearInterval(timer); window.removeEventListener('focus', focus);
      socket?.off('connect', subscribe); socket?.off('disconnect', disconnected);
      socket?.off('order.status.updated', event); socket?.off('payment.status.updated', event);
      // Chỉ rời room của đơn này, giữ kết nối chung cho thông báo và các trang khác.
      if (socket?.connected) socket.emit('order.unsubscribe', { orderId: initialOrder.id });
    };
  }, [initialOrder.id, socket, revision]);

  const paymentText = order.status === 'CANCELLED' ? ''
    : order.paymentStatus === 'REFUNDED' ? 'Đơn hàng đã được hoàn tiền.'
      : order.totalAmount === 0 && order.paymentStatus === 'PAID' ? 'Voucher đã thanh toán toàn bộ giá trị đơn.'
        : order.paymentMethod === 'cash' ? (order.paymentStatus === 'PAID' ? 'Đã thanh toán tiền mặt.' : 'Thanh toán tiền mặt khi ghé lấy.')
          : order.paymentStatus === 'PAID' ? 'Đã thanh toán qua VNPAY.' : 'Chưa hoàn tất thanh toán VNPAY. Bạn có thể tiếp tục ở trang chi tiết đơn.';
  return <section className="item-card rb-placed-order" aria-label="Đơn vừa đặt">
    {!unavailable && <>
      <p className="rb-placed-order-heading" role="status">Đơn <strong>{order.orderCode}</strong> đã đặt. {paymentText}</p>
      <OrderStatusStepper currentStatus={order.status} />
      {['CONFIRMED', 'PREPARING', 'READY'].includes(order.status) && <div className="rb-placed-order-eta"><PickupCountdown estimatedPickupAt={order.estimatedPickupAt} pickupType={order.pickupType} /></div>}
      <small className="rb-order-sync">{connected ? 'Đang cập nhật trực tiếp' : 'Tự kiểm tra trạng thái mỗi 15 giây'}</small>
    </>}
    {error && <p className="rb-order-sync-error" role="alert">{error} <button type="button" className="btn secondary" onClick={() => setRevision((n) => n + 1)}>Thử lại</button></p>}
    <div className="rb-placed-order-links"><Link to="/kham-pha">Khám phá quán</Link><Link to={'/orders/' + initialOrder.id}>Xem chi tiết đơn</Link></div>
  </section>;
}
