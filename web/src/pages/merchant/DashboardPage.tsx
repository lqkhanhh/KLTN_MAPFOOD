import { Link } from 'react-router-dom';
import { useMerchant } from '../../contexts/MerchantContext';
import { useMerchantOrders } from './useMerchantOrders';
import { RestaurantImageEditor } from './RestaurantImageEditor';

export function DashboardPage() {
  const { restaurant } = useMerchant();
  const { orders, loading, error, refresh } = useMerchantOrders(restaurant?.id);
  const complete = orders.filter((o) => o.status === 'COMPLETED');
  return <section><div className="rb-merchant-page-head"><div><p className="rb-eyebrow">KHÔNG GIAN CHỦ QUÁN</p><h1>Tổng quan</h1><p>{restaurant?.name}</p></div></div>
    {error && <p className="auth-alert" role="alert">{error} <button onClick={refresh}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải thống kê…</p> : !error && <div className="rb-merchant-metrics">
      <article><span>Đơn đang xử lý</span><strong>{orders.filter((o) => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length}</strong></article>
      <article><span>Đơn hoàn thành</span><strong>{complete.length}</strong></article>
      <article><span>Doanh thu đơn hoàn thành</span><strong>{complete.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + Number(o.totalAmount), 0).toLocaleString('vi-VN')}đ</strong></article>
      <article><span>Món đang bán</span><strong>{restaurant?.menuItems.filter((i: any) => i.available).length || 0}</strong></article>
    </div>}
    <div className="item-card rb-merchant-shop"><h2>Thông tin quán</h2><p>{restaurant?.address}</p><p>Giờ mở cửa: {restaurant?.openingHours}</p><p>{restaurant?.suspendedAt != null || restaurant?.suspendedReason != null ? 'Bị Admin đình chỉ' : restaurant?.active ? 'Đang hoạt động' : 'Đang tạm ngừng'}</p>
      <div className="btn-row"><Link className="btn primary" to="/merchant/orders">Xử lý đơn hàng</Link><Link className="btn secondary" to="/merchant/menu">Quản lý Menu</Link></div>
    </div>
    <p className="rb-merchant-hint">Số liệu tính từ toàn bộ đơn của quán đang chọn, không phải thống kê riêng hôm nay.</p>
    {restaurant && <RestaurantImageEditor key={restaurant.id} restaurant={restaurant} />}
  </section>;
}
