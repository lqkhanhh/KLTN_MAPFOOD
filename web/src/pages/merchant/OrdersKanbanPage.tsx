import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMerchant } from '../../contexts/MerchantContext';
import { request } from '../../api';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { PickupCountdown } from '../../components/PickupCountdown';
import { useMerchantOrders } from './useMerchantOrders';

const columns = [{ status: 'PENDING', label: 'Chờ xác nhận / Đã xác nhận' }, { status: 'PREPARING', label: 'Đang chuẩn bị' }, { status: 'READY', label: 'Sẵn sàng' }, { status: 'COMPLETED', label: 'Hoàn thành' }];
const next: Record<string, { status: string; label: string }> = {
  PENDING: { status: 'CONFIRMED', label: 'Xác nhận →' }, CONFIRMED: { status: 'PREPARING', label: 'Bắt đầu chuẩn bị →' },
  PREPARING: { status: 'READY', label: 'Sẵn sàng →' }, READY: { status: 'COMPLETED', label: 'Khách đã lấy ✓' },
};
export function OrdersKanbanPage() {
  const { restaurant } = useMerchant();
  const { orders, loading, error, refresh } = useMerchantOrders(restaurant?.id);
  const [busy, setBusy] = useState(''); const [actionError, setActionError] = useState(''); const [cancelled, setCancelled] = useState(false);
  async function advance(order: any, status: string) {
    if (busy || (status === 'CANCELLED' && !window.confirm(`Hủy đơn ${order.orderCode}?`))) return;
    setBusy(order.id); setActionError('');
    try { await request(`/orders/${order.id}/status`, { method: 'PATCH', body: { status } }); await refresh(); }
    catch (e: any) { setActionError(e.message || 'Không thể cập nhật trạng thái'); }
    finally { setBusy(''); }
  }
  const renderCard = (order: any) => {
    const action = next[order.status];
    const awaitingPayment = order.paymentMethod === 'vnpay' && order.paymentStatus !== 'PAID';
    return <article className="rb-kanban-card" key={order.id}>
      <Link to={'/merchant/orders/' + order.id} className="rb-order-code">{order.orderCode}</Link><OrderStatusBadge status={order.status} />
      <strong>{order.customerName || 'Khách hàng'}</strong><span>{order.customerPhone}</span>
      <p>{order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} món · {Number(order.totalAmount).toLocaleString('vi-VN')}đ</p>
      <p>{order.paymentMethod === 'cash' ? (order.paymentStatus === 'PAID' ? 'Tiền mặt · Đã thu' : 'Tiền mặt · Thu khi ghé lấy') : awaitingPayment ? 'VNPAY · Chưa thanh toán' : 'VNPAY · Đã thanh toán'}</p>
      {!['CANCELLED', 'COMPLETED'].includes(order.status) && <PickupCountdown estimatedPickupAt={order.estimatedPickupAt} pickupType={order.pickupType} />}
      {action && <button className="btn primary" type="button" disabled={!!busy || awaitingPayment} onClick={() => advance(order, action.status)}>{busy === order.id ? 'Đang cập nhật…' : action.label}</button>}
      {['PENDING', 'CONFIRMED'].includes(order.status) && <button className="rb-danger-button" type="button" disabled={!!busy} onClick={() => advance(order, 'CANCELLED')}>Hủy đơn</button>}
    </article>;
  };
  return <section><div className="rb-merchant-page-head"><div><p className="rb-eyebrow">ĐIỀU PHỐI GHÉ LẤY</p><h1>Đơn hàng</h1><p>{restaurant?.name}</p></div><button className="btn secondary" onClick={refresh}>Làm mới</button></div>
    {(error || actionError) && <p role="alert" className="auth-alert">{actionError || error}</p>}
    {loading ? <p role="status">Đang tải đơn hàng…</p> : <div className="rb-kanban-board">{columns.map((column) => {
      const items = orders.filter((o) => column.status === 'PENDING' ? ['PENDING', 'CONFIRMED'].includes(o.status) : o.status === column.status);
      return <section className="rb-kanban-column" key={column.status} aria-label={column.label}><h2>{column.label} <span>{items.length}</span></h2>{items.length ? items.map(renderCard) : <p className="rb-empty">Chưa có đơn</p>}</section>;
    })}</div>}
    <button className="btn secondary rb-cancelled-toggle" type="button" aria-expanded={cancelled} onClick={() => setCancelled(!cancelled)}>Đã hủy ({orders.filter((o) => o.status === 'CANCELLED').length})</button>
    {cancelled && <div className="rb-cancelled-orders">{orders.filter((o) => o.status === 'CANCELLED').map(renderCard)}</div>}
  </section>;
}
