import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api';
import { useAuth } from '../contexts/AuthContext';
import RestaurantCard from './RestaurantCard';

export function ReorderSuggestions() {
  const { currentUser } = useAuth();
  if (currentUser?.role !== 'customer') return null;
  return <CustomerSuggestions key={currentUser.id} userId={currentUser.id} />;
}
function CustomerSuggestions({ userId }: { userId: string }) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    request('/orders').then((response) => {
      const orders = Array.isArray(response) ? response : response?.data;
      if (!Array.isArray(orders)) return;
      const seen = new Set();
      const shops: any[] = [];
      const completed = orders.filter((order) => order.status === 'COMPLETED' && order.userId === userId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      for (const order of completed) {
        const shop = order.restaurant;
        if (!shop?.id || seen.has(shop.id)) continue;
        seen.add(shop.id); shops.push(shop);
        if (shops.length === 6) break;
      }
      if (active) setRestaurants(shops);
    }).catch(() => { /* Gợi ý phụ không chặn chức năng khám phá khi API lỗi. */ });
    return () => { active = false; };
  }, [userId]);
  if (!restaurants.length) return null;
  return <section className="rb-reorder-suggestions" aria-labelledby="reorder-heading">
    <h2 id="reorder-heading">Đặt lại từ quán quen thuộc</h2><p>Chọn quán để xem menu và giá hiện tại.</p>
    <div className="rb-reorder-strip">{restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant}
      onOpen={() => navigate(`/restaurant/${restaurant.id}`)} />)}</div>
  </section>;
}
