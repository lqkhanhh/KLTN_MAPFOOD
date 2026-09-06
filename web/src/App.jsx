import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Home from './Home';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProfilePage from './ProfilePage';
import AvatarDropdown from './components/AvatarDropdown';
import { request, TOKEN_KEY } from './api';
import { AuthProvider } from './contexts/AuthContext';
import { OrderStatusBadge } from './components/OrderStatusBadge';
import { PickupCountdown } from './components/PickupCountdown';
import { QuantityStepper } from './components/QuantityStepper';
import { FoodThumbnail } from './components/FoodThumbnail';

const CartContext = createContext(null);
const CART_KEY = 'routebite_cart';
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const demoMenu = { id: 'mock-com-tam', name: 'Cơm Tấm Mẫu', address: 'Quận 1, TP. Hồ Chí Minh', rating: 4.8, menuItems: [{ id: 'demo-com-tam', name: 'Cơm tấm sườn bì chả', description: 'Sườn nướng, bì, chả trứng và đồ chua', price: 60000, available: true }, { id: 'demo-tra-dao', name: 'Trà đào cam sả', description: 'Ly mát lạnh', price: 25000, available: true }] };

function Header() {
  const navigate = useNavigate();
  const { cart } = useContext(CartContext);
  return <header className="consumer-header"><Link className="consumer-logo" to="/">RouteBite</Link><nav><Link className="consumer-nav active" to="/">Trang chủ</Link><Link className="consumer-nav" to="/kham-pha">Khám phá</Link><Link className="consumer-nav" to="/my-orders">Đơn của tôi</Link><Link className="consumer-nav" to="/my-carts">Giỏ của tôi{cart.length ? ` (${cart.reduce((s, item) => s + item.quantity, 0)})` : ''}</Link></nav><div className="account-menu"><button className="bell-icon" type="button" aria-label="Thông báo"><span /></button><AvatarDropdown /></div></header>;
}

function RestaurantMenu() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, add, change } = useContext(CartContext);
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
          onIncrease={() => add({ ...item, restaurantId: restaurant.id, restaurantName: restaurant.name, pickupMinutes: Number(pickup) })}
          onDecrease={() => change(item.id, -1)} />
      </article>) : <div className="item-card rb-empty">Quán chưa có món đang bán.</div>}
    </section>
    <Link className="rb-menu-cart" to="/my-carts"><span>Xem giỏ hàng · {count} món</span><strong>{formatMoney(total)}</strong></Link>
  </main>;
}

function CartPage() {
  const navigate = useNavigate();
  const { cart, change, clear } = useContext(CartContext);
  const routeEta = Math.max(1, Number(localStorage.getItem('routebite_route_eta_minutes')) || 15);
  const [method, setMethod] = useState('cash');
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
        body: { restaurantId: cart[0].restaurantId, pickupOption, payment: { method },
          items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })) },
      });
      if (method === 'vnpay') {
        const payment = await request('/payments/create', { method: 'POST', body: { orderId: order.id } });
        if (!payment.checkoutUrl) throw new Error('Không tạo được liên kết thanh toán VNPAY');
        clear();
        window.location.assign(payment.checkoutUrl);
        return;
      }
      setMessage('Đơn ' + order.orderCode + ' đã đặt. Thanh toán tiền mặt khi ghé lấy.');
      clear();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <main className="app-page rb-commerce-page rb-cart-page">
    <div className="page-intro"><p className="rb-eyebrow">GIỎ HÀNG</p><h1>Ghé lấy mang đi</h1><p>Kiểm tra món, chọn giờ lấy và phương thức thanh toán.</p></div>
    {message && <p className="item-card rb-feedback" role="status">{message}</p>}
    {cart.length ? <div className="rb-cart-layout">
      <section className="item-card rb-cart-items"><h2>{cart[0].restaurantName || 'Món đã chọn'}</h2>
        {cart.map((item) => <article className="rb-product-row rb-cart-row" key={item.id}>
          <FoodThumbnail src={item.imageUrl} name={item.name} />
          <div className="rb-product-copy"><h3>{item.name}</h3><p>{formatMoney(item.price)} / món</p><strong>{formatMoney(Number(item.price) * item.quantity)}</strong></div>
          <QuantityStepper name={item.name} quantity={item.quantity} disabled={busy}
            onIncrease={() => change(item.id, 1)} onDecrease={() => change(item.id, -1)} />
        </article>)}
      </section>
      <aside className="item-card rb-cart-summary">
        <div className="rb-cart-total"><div><h2>Tổng cộng</h2><span>{count} món</span></div><strong>{formatMoney(total)}</strong></div>
        <fieldset><legend>Giờ lấy hàng</legend>
          <label><input name="pickup-type" type="radio" disabled={busy} checked={pickupType === 'asap'} onChange={() => setPickupType('asap')} /> Lấy sớm nhất</label>
          {pickupType === 'asap' && <select aria-label="Thời gian lấy món" disabled={busy} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {minuteOptions.map((value) => <option value={value} key={value}>{value === routeEta ? 'Theo lộ trình: khoảng ' : 'Sau khoảng '}{value} phút</option>)}
          </select>}
          <label><input name="pickup-type" type="radio" disabled={busy} checked={pickupType === 'scheduled'} onChange={() => setPickupType('scheduled')} /> Hẹn giờ lấy món</label>
          {pickupType === 'scheduled' && <input aria-label="Giờ hẹn lấy món" type="datetime-local" disabled={busy} value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />}
        </fieldset>
        <fieldset><legend>Phương thức thanh toán</legend>
          <label><input name="payment-method" type="radio" disabled={busy} checked={method === 'cash'} onChange={() => setMethod('cash')} /> Tiền mặt khi ghé lấy</label>
          <label><input name="payment-method" type="radio" disabled={busy} checked={method === 'vnpay'} onChange={() => setMethod('vnpay')} /> VNPAY (QR / Thẻ ATM / Visa)</label>
        </fieldset>
        <button type="button" className="rb-checkout-button" disabled={busy || (pickupType === 'scheduled' && !scheduledTime)} onClick={checkout}>
          {busy ? 'Đang tạo đơn…' : method === 'vnpay' ? 'Tiếp tục đến VNPAY' : 'Đặt hàng'}
        </button>
      </aside>
    </div> : <section className="item-card rb-empty"><p>Giỏ hàng đang trống. Hãy chọn món từ menu quán.</p><Link to="/">Khám phá quán</Link>{message && <Link to="/my-orders">Xem đơn của tôi</Link>}</section>}
  </main>;
}

function OrdersPage() {
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
  return <main className="app-page rb-commerce-page rb-orders-page">
    <div className="page-intro"><p className="rb-eyebrow">ĐƠN HÀNG</p><h1>Đơn của tôi</h1><p>Theo dõi trạng thái và tiến độ đơn hàng của bạn.</p></div>
    {orders.length ? <section className="rb-orders-list">{orders.map((order) => {
      const status = String(order.status).toUpperCase();
      const first = order.items?.[0];
      return <article className="item-card rb-order-card" key={order.id}>
        <div className="rb-order-heading">
          <FoodThumbnail src={first?.imageUrl} name={first?.itemName || first?.name || 'Món trong đơn'} />
          <div className="rb-order-copy">
            <small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small>
            <p className="rb-order-code">{order.orderCode}</p>
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
      </article>;
    })}</section> : <section className="item-card rb-empty">Bạn chưa có đơn hàng nào.</section>}
  </main>;
}
function Page({ title, children }) { return <main className="app-page"><div className="page-intro"><p>ROUTEBITE</p><h1>{title}</h1></div><section className="orders-empty-v2">{children || 'Tính năng đang được đồng bộ.'}</section></main>; }
function MerchantPage() { const user = JSON.parse(localStorage.getItem('routebite_user') || 'null'); return <Page title="Khu vực quản lý">{user?.role === 'merchant' || user?.role === 'admin' ? 'Bạn đã đăng nhập với quyền quản lý quán. API tạo/sửa quán đã được backend bảo vệ theo role.' : 'Trang này chỉ dành cho merchant hoặc admin.'}</Page>; }
function AppShell() { const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem(CART_KEY) || '[]')); const value = useMemo(() => ({ cart, add(item) { setCart((old) => { const same = old.find((entry) => entry.id === item.id); const next = same ? old.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.min(100, entry.quantity + 1) } : entry) : [...old.filter((entry) => entry.restaurantId === item.restaurantId), { ...item, quantity: 1 }]; localStorage.setItem(CART_KEY, JSON.stringify(next)); return next; }); }, change(id, step) { setCart((old) => { const next = old.map((entry) => entry.id === id ? { ...entry, quantity: Math.min(100, entry.quantity + step) } : entry).filter((entry) => entry.quantity > 0); localStorage.setItem(CART_KEY, JSON.stringify(next)); return next; }); }, clear() { localStorage.removeItem(CART_KEY); setCart([]); } }), [cart]); return <CartContext.Provider value={value}><Header /><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/restaurant/:id" element={<RestaurantMenu />} /><Route path="/my-carts" element={<CartPage />} /><Route path="/my-orders" element={<OrdersPage />} /><Route path="/merchant" element={<MerchantPage />} /><Route path="/merchant/onboarding" element={<Page title="Đăng ký quán" />} /><Route path="/admin/overview" element={<Page title="Quản trị hệ thống" />} /><Route path="/kham-pha" element={<Page title="Khám phá quán" />} /></Routes></CartContext.Provider>; }
export default function App() { return <AuthProvider><BrowserRouter><AppShell /></BrowserRouter></AuthProvider>; }
