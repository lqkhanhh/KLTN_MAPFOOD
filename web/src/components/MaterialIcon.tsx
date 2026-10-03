type IconName = 'home' | 'explore' | 'orders' | 'cart' | 'dashboard' | 'menu' | 'reviews' | 'users' | 'voucher' | 'shop' | 'documents';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  explore: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M16 8l-3 5-5 3 3-5 5-3',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3M9 7h6M9 11h6M9 15h3',
  cart: 'M3 3h2l3 12h10l3-9H6M9 19h.01M18 19h.01',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  menu: 'M5 3v7m3-7v7M3 3v5a3 3 0 0 0 6 0V3M6 11v10M18 3v18m0-18c-4 2-4 9 0 9',
  reviews: 'm12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1 3-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-4',
  voucher: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5M9 8h.01M15 16h.01M9 16l6-8',
  shop: 'M3 10 5 3h14l2 7M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 13v8h14v-8M9 21v-6h6v6',
  documents: 'M5 3h10l4 4v14H5V3M15 3v5h4M8 12h8M8 16h5',
};
export function MaterialIcon({ name }: { name: IconName }) {
  return <svg className="md-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
