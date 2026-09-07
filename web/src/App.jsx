import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Home from './Home';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProfilePage from './ProfilePage';
import AvatarDropdown from './components/AvatarDropdown';
import { request, TOKEN_KEY } from './api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrderStatusBadge } from './components/OrderStatusBadge';
import { PickupCountdown } from './components/PickupCountdown';
import { QuantityStepper } from './components/QuantityStepper';
import { FoodThumbnail } from './components/FoodThumbnail';
import { RouteSummaryCard } from './components/RouteSummaryCard';
import { PaymentMethodSelector, usePaymentMethod } from './components/PaymentMethodSelector';
import { validateOrderPayload } from './types/checkout';
import { readRouteOrigin, restaurantPoint, routeQuery } from './utils/routeContext';

import { CartProvider, useCart } from './contexts/CartContext';
import { MyCartsPage } from './pages/MyCartsPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { ExplorePage } from './pages/ExplorePage';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { NotificationBell } from './components/NotificationBell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MerchantProvider } from './contexts/MerchantContext';
import { MerchantLayout } from './layouts/MerchantLayout';
import { DashboardPage } from './pages/merchant/DashboardPage';
import { MenuManagementPage } from './pages/merchant/MenuManagementPage';
import { OrdersKanbanPage } from './pages/merchant/OrdersKanbanPage';
import { OnboardingPage } from './pages/merchant/OnboardingPage';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminRestaurantsPage } from './pages/admin/AdminRestaurantsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminMerchantApplicationsPage } from './pages/admin/AdminMerchantApplicationsPage';
import { PartnerRegistrationPage } from './pages/partner/PartnerRegistrationPage';
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const demoMenu = { id: 'mock-com-tam', name: 'Cơm Tấm Mẫu', address: 'Quận 1, TP. Hồ Chí Minh', rating: 4.8, menuItems: [{ id: 'demo-com-tam', name: 'Cơm tấm sườn bì chả', description: 'Sườn nướng, bì, chả trứng và đồ chua', price: 60000, available: true }, { id: 'demo-tra-dao', name: 'Trà đào cam sả', description: 'Ly mát lạnh', price: 25000, available: true }] };

function Header() {
  const { carts } = useCart();
  const navItems = [
    { path: '/', label: 'Trang chủ' },
    { path: '/kham-pha', label: 'Khám phá' },
    { path: '/my-orders', label: 'Đơn của tôi' },
    { path: '/my-carts', label: `Giỏ của tôi${carts.length ? ` (${carts.length})` : ''}` },
  ];
  return <header className="consumer-header">
    <Link className="consumer-logo" to="/">RouteBite</Link>
    <nav aria-label="Điều hướng chính">
      {navItems.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'}
        className={({ isActive }) => `consumer-nav${isActive ? ' active' : ''}`}>
        {item.label}
      </NavLink>)}
    </nav>
    <div className="account-menu"><NotificationBell /><AvatarDropdown /></div>
  </header>;
}

function RestaurantMenu() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const origin = readRouteOrigin(params);
  const navigate = useNavigate();
  const { cart, add, change } = useCart();
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState('');
  const [pickup, setPickup] = useState('15');

  useEffect(() => {
    let active = true;
    setError('');
    setRestaurant(null);
    if (id.startsWith('mock-')) {
      setRestaurant({ ...demoMenu, id });
    } else {
      request('/restaurants/' + id, { authorized: false })
        .then((data) => { if (active) setRestaurant(data); })
        .catch((e) => { if (active) setError(e.message); });
    }
    return () => { active = false; };
  }, [id]);

  if (error) return <Page title="Không mở được menu">{error}</Page>;
  if (!restaurant) return <Page title="Menu quán">Đang tải menu…</Page>;
  const menu = (restaurant.menuItems || []).filter((item) => item.available);
  const selected = cart.filter((item) => item.restaurantId === restaurant.id);
  const count = selected.reduce((sum, item) => sum + item.quantity, 0);
  const total = selected.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  return <main className="app-page rb-commerce-page rb-menu-page">
    <button type="button" className="back-link" onClick={() => navigate(-1)}>← Quay lại</button>
    <section className="item-card rb-restaurant-intro">
      <FoodThumbnail src={restaurant.imageUrl} name={restaurant.name} className="rb-restaurant-image" />
      <div><p className="rb-eyebrow">GHÉ LẤY MANG ĐI</p><h1>{restaurant.name}</h1><p>{restaurant.address}</p><span>⭐ {restaurant.rating || 'Mới'}</span></div>
      <a className="btn secondary" target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(restaurant.address)}>Chỉ đường</a>
    </section>
    <section className="item-card rb-pickup-choice">
      <label htmlFor="menu-pickup">Thời gian ghé lấy</label>
      <select id="menu-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)}>
        <option value="15">Sau 15 phút</option><option value="30">Sau 30 phút</option><option value="45">Sau 45 phút</option>
      </select>
    </section>
    <section className="rb-menu-list"><h2>Menu món ăn</h2>
      {menu.length ? menu.map((item) => <article className="item-card rb-product-row" key={item.id}>
        <FoodThumbnail src={item.imageUrl} name={item.name} />
        <div className="rb-product-copy"><h3>{item.name}</h3><p>{item.description || 'Món ngon của quán'}</p><strong>{formatMoney(item.price)}</strong></div>
        <QuantityStepper name={item.name} quantity={selected.find((entry) => entry.id === item.id)?.quantity || 0}
          onIncrease={() => add({ ...item, restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantImage: restaurant.imageUrl, pickupMinutes: Number(pickup), routeOrigin: origin, destination: restaurantPoint(restaurant), restaurantAddress: restaurant.address })}
          onDecrease={() => change(restaurant.id, item.id, -1)} />
      </article>) : <div className="item-card rb-empty">Quán chưa có món đang bán.</div>}
    </section>
    <Link className="rb-menu-cart" to={'/restaurants/' + restaurant.id + '/cart' + routeQuery(origin)}><span>Xem giỏ hàng · {count} món</span><strong>{formatMoney(total)}</strong></Link>
  </main>;
}

function CartPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { carts, change, clear, rememberOrigin } = useCart();
  const [params] = useSearchParams();
  const savedCart = carts.find((entry) => entry.restaurantId === id);
  const cart = savedCart?.items || [];
  const [restaurant, setRestaurant] = useState(null);
  useEffect(() => {
    const origin = readRouteOrigin(params);
    if (origin) rememberOrigin(id, origin);
  }, [id, params, rememberOrigin]);
  useEffect(() => {
    let active = true;
    setRestaurant(null);
    // Giỏ cũ chưa có tọa độ/địa chỉ: lấy thông tin quán, giữ nguyên các món đã lưu.
    if (savedCart && !savedCart.destination) request('/restaurants/' + id, { authorized: false })
      .then((data) => { if (active) setRestaurant(data); }).catch(() => {});
    return () => { active = false; };
  }, [id, !!savedCart, savedCart?.destination]);
  const [createdOrder, setCreatedOrder] = useState(null);
  const routeEta = Math.max(1, Number(localStorage.getItem('routebite_route_eta_minutes')) || 15);
  const [method, setMethod] = usePaymentMethod();
  const [pickupType, setPickupType] = useState('asap');
  const [minutes, setMinutes] = useState(cart[0]?.pickupMinutes || routeEta);
  const [scheduledTime, setScheduledTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const minuteOptions = [...new Set([routeEta, Number(minutes), 15, 30, 45])];

  async function checkout() {
    if (!cart.length || busy) return;
    if (!localStorage.getItem(TOKEN_KEY)) return navigate('/login');
    setBusy(true);
    setMessage('');
    try {
      const scheduled = new Date(scheduledTime);
      if (pickupType === 'scheduled' && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now())) {
        throw new Error('Vui lòng chọn giờ lấy món trong tương lai.');
      }
      const pickupOption = pickupType === 'asap'
        ? { type: 'asap', estimatedPickupMinutes: Number(minutes) }
        : { type: 'scheduled', scheduledTime: scheduled.toISOString() };
      const order = await request('/orders', {
        method: 'POST',
        body: validateOrderPayload({ restaurantId: cart[0].restaurantId, pickupOption, payment: { method },
          items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })) }),
      });
      setCreatedOrder(order);
      clear(id);
      if (method === 'vnpay') {
        const payment = await request('/payments/create', { method: 'POST', body: { orderId: order.id } });
        if (!payment.checkoutUrl) throw new Error('Không tạo được liên kết thanh toán VNPAY');
        window.location.assign(payment.checkoutUrl);
        return;
      }
      setMessage('Đơn ' + order.orderCode + ' đã đặt. Thanh toán tiền mặt khi ghé lấy.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <main className="app-page rb-commerce-page rb-cart-page">
    <Link className="back-link" to="/my-carts">← Giỏ hàng của tôi</Link><div className="page-intro"><p className="rb-eyebrow">GIỎ HÀNG</p><h1>Ghé lấy mang đi</h1><p>Kiểm tra món, chọn giờ lấy và phương thức thanh toán.</p></div>
    {message && <p className="item-card rb-feedback" role="status">{message}</p>}
    {cart.length ? <div className="rb-cart-layout">
      <section className="item-card rb-cart-items"><h2>{cart[0].restaurantName || 'Món đã chọn'}</h2>
        {cart.map((item) => <article className="rb-product-row rb-cart-row" key={item.id}>
          <FoodThumbnail src={item.imageUrl} name={item.name} />
          <div className="rb-product-copy"><h3>{item.name}</h3><p>{formatMoney(item.price)} / món</p><strong>{formatMoney(Number(item.price) * item.quantity)}</strong></div>
          <QuantityStepper name={item.name} quantity={item.quantity} disabled={busy}
            onIncrease={() => change(id, item.id, 1)} onDecrease={() => change(id, item.id, -1)} />
        </article>)}
      </section>
      <aside className="item-card rb-cart-summary">
        <RouteSummaryCard restaurantName={savedCart.restaurantName} restaurantAddress={savedCart.restaurantAddress || restaurant?.address}
          destination={savedCart.destination || restaurantPoint(restaurant)} origin={savedCart.routeOrigin} />
        <div className="rb-cart-total"><div><h2>Tổng cộng</h2><span>{count} món</span></div><strong>{formatMoney(total)}</strong></div>
        <fieldset><legend>Giờ lấy hàng</legend>
          <label><input name="pickup-type" type="radio" disabled={busy} checked={pickupType === 'asap'} onChange={() => setPickupType('asap')} /> Lấy sớm nhất</label>
          {pickupType === 'asap' && <select aria-label="Thời gian lấy món" disabled={busy} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {minuteOptions.map((value) => <option value={value} key={value}>{value === routeEta ? 'Theo lộ trình: khoảng ' : 'Sau khoảng '}{value} phút</option>)}
          </select>}
          <label><input name="pickup-type" type="radio" disabled={busy} checked={pickupType === 'scheduled'} onChange={() => setPickupType('scheduled')} /> Hẹn giờ lấy món</label>
          {pickupType === 'scheduled' && <input aria-label="Giờ hẹn lấy món" type="datetime-local" disabled={busy} value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />}
        </fieldset>
        <PaymentMethodSelector value={method} onChange={setMethod} disabled={busy} />
        <button type="button" className="rb-checkout-button" disabled={busy || (pickupType === 'scheduled' && !scheduledTime)} onClick={checkout}>
          {busy ? 'Đang tạo đơn…' : method === 'vnpay' ? 'Tiếp tục đến VNPAY' : 'Đặt hàng'}
        </button>
      </aside>
    </div> : <section className="item-card rb-empty"><p>Giỏ hàng đang trống. Hãy chọn món từ menu quán.</p><Link to="/">Khám phá quán</Link>{createdOrder && <Link to={'/orders/' + createdOrder.id}>Xem đơn vừa đặt</Link>}</section>}
  </main>;
}

const ORDER_FILTERS = [
  { key: 'all', label: 'Tất cả', statuses: [], empty: 'Bạn chưa có đơn hàng nào.' },
  { key: 'processing', label: 'Đang xử lý', statuses: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'], empty: 'Bạn không có đơn nào đang xử lý.' },
  { key: 'completed', label: 'Hoàn thành', statuses: ['COMPLETED'], empty: 'Bạn chưa có đơn hàng hoàn thành.' },
  { key: 'cancelled', label: 'Đã hủy', statuses: ['CANCELLED'], empty: 'Bạn không có đơn hàng đã hủy.' },
];
function OrdersPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [cancelling, setCancelling] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const token = localStorage.getItem(TOKEN_KEY);
  useEffect(() => {
    let active = true;
    setError('');
    if (!token) { setOrders([]); return; }
    request('/orders')
      .then((data) => { if (active) setOrders(Array.isArray(data) ? data : data.data || []); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);

  if (!token) return <Page title="Đơn của tôi">Vui lòng <Link to="/login">đăng nhập</Link> để xem đơn hàng.</Page>;
  if (error) return <Page title="Đơn của tôi">{error}</Page>;
  if (!orders) return <Page title="Đơn của tôi">Đang tải…</Page>;
  const matches = (filter, order) => filter.key === 'all' || filter.statuses.includes(String(order.status).toUpperCase());
  const filter = ORDER_FILTERS.find((entry) => entry.key === activeFilter);
  const filteredOrders = orders.filter((order) => matches(filter, order));
  async function cancelOrder(id) {
    if (cancelling || !window.confirm('Bạn chắc chắn muốn hủy đơn này?')) return;
    setCancelling(id); setCancelError('');
    try {
      const updated = await request('/orders/' + id + '/status', { method: 'PATCH', body: { status: 'CANCELLED' } });
      setOrders((old) => old.map((order) => order.id === id ? updated : order));
    } catch (e) { setCancelError(e.message); }
    finally { setCancelling(null); }
  }
  return <main className="app-page rb-commerce-page rb-orders-page">
    <div className="page-intro"><p className="rb-eyebrow">ĐƠN HÀNG</p><h1>Đơn của tôi</h1><p>Theo dõi trạng thái và tiến độ đơn hàng của bạn.</p></div>
    <div className="rb-order-filters" aria-label="Lọc trạng thái đơn">
      {ORDER_FILTERS.map((entry) => <button key={entry.key} type="button" aria-pressed={entry.key === activeFilter} onClick={() => setActiveFilter(entry.key)}>
        {entry.label} ({orders.filter((order) => matches(entry, order)).length})
      </button>)}
    </div>
    {cancelError && <p className="auth-alert" role="alert">{cancelError}</p>}
    {filteredOrders.length ? <section className="rb-orders-list">{filteredOrders.map((order) => {
      const status = String(order.status).toUpperCase();
      const first = order.items?.[0];
      return <article className="item-card rb-order-card rb-clickable-order" key={order.id} onClick={() => navigate('/orders/' + order.id)}>
        <div className="rb-order-heading">
          <FoodThumbnail src={first?.imageUrl || order.restaurant?.imageUrl} name={first?.itemName || first?.name || 'Món trong đơn'} />
          <div className="rb-order-copy">
            <small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small>
            <p className="rb-order-code"><Link to={'/orders/' + order.id}>{order.orderCode}</Link></p>
            <h3>{order.restaurant?.name || order.restaurantName || 'Quán ăn'}</h3>
            <p>{first?.itemName || first?.name || 'Món đã đặt'}{order.items?.length > 1 ? ' và ' + (order.items.length - 1) + ' món khác' : ''}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="rb-order-footer"><strong>{formatMoney(order.totalAmount)}</strong>
          {status === 'COMPLETED' ? <span>{(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} món</span>
            : status === 'CANCELLED' ? null
            : status === 'READY' ? <span className="rb-pickup-due">Món đã sẵn sàng, ghé lấy nhé!</span>
            : ['PENDING', 'CONFIRMED', 'PREPARING'].includes(status) ? <PickupCountdown estimatedPickupAt={order.estimatedPickupAt} pickupType={order.pickupType} /> : null}
        </div>
        {status === 'PENDING' && currentUser?.role === 'customer' && <button type="button" className="rb-danger-button" disabled={!!cancelling}
          onClick={(event) => { event.stopPropagation(); cancelOrder(order.id); }}>
          {cancelling === order.id ? 'Đang hủy…' : 'Hủy đơn'}
        </button>}
      </article>;
    })}</section> : <section className="item-card rb-empty">{filter.empty}</section>}
  </main>;
}
function Page({ title, children }) { return <main className="app-page"><div className="page-intro"><p>ROUTEBITE</p><h1>{title}</h1></div><section className="orders-empty-v2">{children || 'Tính năng đang được đồng bộ.'}</section></main>; }
function AppShell() {
  const { pathname } = useLocation();
  const merchantRoute = pathname === '/merchant' || pathname.startsWith('/merchant/');
  const adminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  return <CartProvider>{!merchantRoute && !adminRoute && <Header />}<Routes>
    <Route path="/" element={<Home />} /><Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} /><Route path="/profile" element={<ProfilePage />} />
    <Route path="/partner/register" element={<PartnerRegistrationPage />} />
    <Route path="/restaurant/:id" element={<RestaurantMenu />} />
    <Route path="/my-carts" element={<MyCartsPage />} />
    <Route path="/restaurants/:id/cart" element={<CartPage />} />
    <Route path="/my-orders" element={<OrdersPage />} /><Route path="/orders/:id" element={<OrderDetailPage />} />
    <Route path="/merchant" element={<ProtectedRoute allowedRoles={['merchant']}><MerchantProvider><MerchantLayout /></MerchantProvider></ProtectedRoute>}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} /><Route path="menu" element={<MenuManagementPage />} />
      <Route path="orders" element={<OrdersKanbanPage />} /><Route path="orders/:id" element={<OrderDetailPage />} />
      <Route path="onboarding" element={<OnboardingPage />} /><Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/merchant/dashboard" replace />} />
    </Route>
    <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<AdminOverviewPage />} />
      <Route path="restaurants" element={<AdminRestaurantsPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="merchant-applications" element={<AdminMerchantApplicationsPage />} />
      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Route>
    <Route path="/kham-pha" element={<ExplorePage />} />
  </Routes></CartProvider>;
}
export default function App() { return <AuthProvider><BrowserRouter><SocketProvider><NotificationsProvider><AppShell /></NotificationsProvider></SocketProvider></BrowserRouter></AuthProvider>; }
