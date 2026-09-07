import { RoutePoint } from './routeContext';

export const SAVED_CARTS_KEY = 'routebite_saved_carts_v1';
export interface CartItem {
  id: string; name: string; price: number; quantity: number;
  restaurantId: string; restaurantName?: string; restaurantImage?: string; imageUrl?: string; pickupMinutes?: number;
  routeOrigin?: RoutePoint; destination?: RoutePoint; restaurantAddress?: string;
}
export interface SavedCart {
  restaurantId: string; restaurantName: string; restaurantImage?: string;
  createdAt: string; items: CartItem[];
  routeOrigin?: RoutePoint; destination?: RoutePoint; restaurantAddress?: string;
}

export function getSavedCarts(): SavedCart[] {
  try {
    const saved = localStorage.getItem(SAVED_CARTS_KEY);
    if (saved !== null) {
      const carts = JSON.parse(saved);
      return Array.isArray(carts) ? carts.filter((cart) => cart?.restaurantId && Array.isArray(cart.items) && cart.items.length).slice(0, 10) : [];
    }
    // Chuyển giỏ cũ sang danh sách; giữ nguyên món đã chọn trước khi nâng cấp.
    const legacy = JSON.parse(localStorage.getItem('routebite_cart') || '[]');
    let carts: SavedCart[] = [];
    if (Array.isArray(legacy)) for (const item of legacy) {
      if (!item?.id || !item.restaurantId || !Number.isInteger(item.quantity) || item.quantity <= 0) continue;
      carts = addCartItem(carts, item, item.quantity);
    }
    return carts;
  } catch { return []; }
}

export function saveCarts(carts: SavedCart[]) {
  localStorage.setItem(SAVED_CARTS_KEY, JSON.stringify(carts.filter((cart) => cart.items.length).slice(0, 10)));
}

export function addCartItem(carts: SavedCart[], item: CartItem, amount = 1): SavedCart[] {
  const found = carts.find((cart) => cart.restaurantId === item.restaurantId);
  if (!found) {
    // FIFO: giỏ mới đứng đầu, giỏ tạo sớm nhất bị loại khi vượt 10 quán.
    return [{ restaurantId: item.restaurantId, restaurantName: item.restaurantName || 'Quán ăn',
      restaurantImage: item.restaurantImage, createdAt: new Date().toISOString(),
      routeOrigin: item.routeOrigin, destination: item.destination, restaurantAddress: item.restaurantAddress,
      items: [{ ...item, quantity: Math.min(100, amount) }] }, ...carts].slice(0, 10);
  }
  return carts.map((cart) => cart !== found ? cart : {
    ...cart, restaurantName: item.restaurantName || cart.restaurantName,
    restaurantImage: item.restaurantImage || cart.restaurantImage,
    routeOrigin: item.routeOrigin || cart.routeOrigin,
    destination: item.destination || cart.destination,
    restaurantAddress: item.restaurantAddress || cart.restaurantAddress,
    items: cart.items.some((entry) => entry.id === item.id)
      ? cart.items.map((entry) => entry.id === item.id ? { ...entry, ...item, quantity: Math.min(100, entry.quantity + amount) } : entry)
      : [...cart.items, { ...item, quantity: Math.min(100, amount) }],
  });
}

export function changeCartItem(carts: SavedCart[], restaurantId: string, id: string, step: number): SavedCart[] {
  return carts.map((cart) => cart.restaurantId !== restaurantId ? cart : {
    ...cart, items: cart.items.map((item) => item.id === id ? { ...item, quantity: Math.min(100, item.quantity + step) } : item).filter((item) => item.quantity > 0),
  }).filter((cart) => cart.items.length);
}
