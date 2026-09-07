import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { addCartItem, changeCartItem, getSavedCarts, saveCarts, SAVED_CARTS_KEY } from '../utils/cartStorage';

const CartContext = createContext(null);
export function CartProvider({ children }) {
  const [carts, setCarts] = useState(getSavedCarts);
  useEffect(() => { saveCarts(carts); }, [carts]);
  useEffect(() => {
    const sync = (event) => { if (event.key === SAVED_CARTS_KEY) setCarts(getSavedCarts()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({
    carts, cart: carts.flatMap((cart) => cart.items),
    add: (item) => setCarts((old) => addCartItem(old, item)),
    rememberOrigin: (restaurantId, origin) => setCarts((old) => {
      const existing = old.find((cart) => cart.restaurantId === restaurantId);
      if (!existing || JSON.stringify(existing.routeOrigin) === JSON.stringify(origin)) return old;
      return old.map((cart) => cart === existing ? { ...cart, routeOrigin: origin } : cart);
    }),
    change: (restaurantId, id, step) => setCarts((old) => changeCartItem(old, restaurantId, id, step)),
    clear: (restaurantId) => {
      // Lưu ngay trước khi chuyển ra cổng thanh toán để không mất thao tác xóa giỏ.
      setCarts((old) => { const next = old.filter((cart) => cart.restaurantId !== restaurantId); saveCarts(next); return next; });
    },
  }), [carts]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { return useContext(CartContext); }
