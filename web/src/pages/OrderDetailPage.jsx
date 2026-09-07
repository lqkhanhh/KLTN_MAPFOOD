import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request, TOKEN_KEY } from '../api';
import { useSockets } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { PickupCountdown } from '../components/PickupCountdown';
import { FoodThumbnail } from '../components/FoodThumbnail';

export function OrderDetailPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const { orders: socket } = useSockets();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const token = localStorage.getItem(TOKEN_KEY);
  useEffect(() => {
    if (!token) return;
    let active = true;
    setOrder(null); setError('');
    const refresh = () => request('/orders/' + id).then((data) => {
      if (active) { setOrder(data); setError(''); }
    }).catch((e) => { if (active) setError(e.message); });
    refresh();
    const subscribe = () => { socket.emit('order.subscribe', { orderId: id }); refresh(); };
    socket?.on('connect', subscribe);
    if (socket?.connected) subscribe();
    socket?.on('order.status.updated', refresh);
    socket?.on('payment.status.updated', refresh);
    // Poll dự phòng khi kết nối realtime tạm gián đoạn.
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false; clearInterval(timer);
      socket?.off('connect', subscribe); socket?.off('order.status.updated', refresh); socket?.off('payment.status.updated', refresh);
      socket?.emit('order.unsubscribe', { orderId: id });
    };
  }, [id, token, socket]);
  const money = (amount) => Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  async function pay() {
    setPaying(true); setError('');
    try {
      const payment = await request('/payments/create', { method: 'POST', body: { orderId: id } });
      if (!payment.checkoutUrl) throw new Error('Không tạo được liên kết VNPAY');
      window.location.assign(payment.checkoutUrl);
    } catch (e) { setError(e.message); setPaying(false); }
  }
  const paymentLabels = { UNPAID: 'Chưa thanh toán', PENDING: 'Đang chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thanh toán thất bại', CANCELLED: 'Đã hủy thanh toán', EXPIRED: 'Hết hạn thanh toán', REFUNDED: 'Đã hoàn tiền' };
  return <main className="app-page rb-commerce-page rb-orders-page">
    <Link className="back-link" to={currentUser?.role === 'merchant' ? '/merchant/orders' : '/my-orders'}>{currentUser?.role === 'merchant' ? '← Đơn hàng của quán' : '← Đơn của tôi'}</Link><h1>Chi tiết đơn hàng</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link> để xem đơn hàng.</p> : <>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {!order && !error && <p>Đang tải đơn hàng…</p>}
      {order && <><section className="item-card">
        <OrderStatusBadge status={order.status} /><h2>{order.restaurant?.name}</h2><p>{order.orderCode}</p><p>{order.restaurant?.address}</p>
        {!['COMPLETED', 'CANCELLED'].includes(order.status) && <PickupCountdown estimatedPickupAt={order.estimatedPickupAt} pickupType={order.pickupType} />}
        <p>{paymentLabels[order.paymentStatus] || 'Đang cập nhật thanh toán'} · {order.paymentMethod === 'cash' ? 'Tiền mặt' : 'VNPAY'}</p>
        {order.status === 'CANCELLED' && order.paymentStatus === 'PAID' && <p>Đơn đã hủy. Vui lòng liên hệ quán để được hỗ trợ hoàn tiền.</p>}
      </section>
      <section className="item-card">{order.items?.map((item) => <div className="rb-product-row rb-cart-row" key={item.id || item.menuItemId}>
        <FoodThumbnail src={item.imageUrl} name={item.itemName} /><div><h3>{item.itemName}</h3><p>{item.quantity} × {money(item.unitPrice)}</p></div><strong>{money(item.lineTotal)}</strong>
      </div>)}<div className="rb-order-footer"><span>Tổng cộng</span><strong>{money(order.totalAmount)}</strong></div></section>
      {currentUser?.role !== 'merchant' && order.paymentMethod === 'vnpay' && !['PAID', 'REFUNDED'].includes(order.paymentStatus) && !['CANCELLED', 'COMPLETED'].includes(order.status) &&
        <button type="button" className="btn primary" disabled={paying} onClick={pay}>{paying ? 'Đang mở VNPAY…' : 'Tiếp tục thanh toán VNPAY'}</button>}
      </>}
    </>}
  </main>;
}
