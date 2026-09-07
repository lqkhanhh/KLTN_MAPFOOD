import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { FoodThumbnail } from '../components/FoodThumbnail';
import type { SavedCart } from '../utils/cartStorage';

export function MyCartsPage() {
  const { carts, clear } = useCart();
  const [manageMode, setManageMode] = useState(false);
  return <main className="app-page rb-commerce-page rb-orders-page">
    <div className="rb-page-heading"><div className="page-intro"><p className="rb-eyebrow">GIỎ HÀNG</p><h1>Giỏ hàng của tôi</h1><p>Lưu tối đa 10 giỏ hàng gần nhất theo quán.</p></div>
      {!!carts.length && <button className="btn secondary" type="button" onClick={() => setManageMode(!manageMode)}>{manageMode ? 'Xong' : 'Quản lý'}</button>}
    </div>
    {!carts.length && <section className="item-card rb-empty"><p>Bạn chưa có giỏ hàng nào, khám phá quán ăn để bắt đầu.</p><Link to="/">Khám phá ngay</Link></section>}
    {carts.map((cart: SavedCart) => {
      const content = <><FoodThumbnail src={cart.restaurantImage} name={cart.restaurantName} />
        <div><h2>{cart.restaurantName}</h2><p>{cart.items.reduce((sum, item) => sum + item.quantity, 0)} món · {cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString('vi-VN')}đ</p></div></>;
      return manageMode ? <article className="item-card rb-saved-cart" key={cart.restaurantId}>{content}
        <button type="button" className="rb-danger-button" aria-label={'Xóa giỏ ' + cart.restaurantName} onClick={() => clear(cart.restaurantId)}>Xóa</button>
      </article> : <Link className="item-card rb-saved-cart" key={cart.restaurantId} to={'/restaurants/' + cart.restaurantId + '/cart'}>{content}<span aria-hidden="true">→</span></Link>;
    })}
  </main>;
}
