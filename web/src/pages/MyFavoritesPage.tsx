import { Link, useNavigate } from 'react-router-dom';
import RestaurantCard from '../components/RestaurantCard';
import { useFavorites } from '../contexts/FavoritesContext';

export function MyFavoritesPage() {
  const { favorites, loading, ready } = useFavorites();
  const navigate = useNavigate();
  return <main className="route-home rb-favorites-page">
    <div className="rb-explore-heading"><p>ROUTEBITE</p><h1>Quán đã lưu</h1><span>Những quán bạn yêu thích, được lưu theo tài khoản.</span></div>
    {loading ? <p role="status">Đang tải quán đã lưu…</p> : !ready ? <p>Hãy thử tải lại danh sách quán đã lưu.</p>
      : favorites.length ? <><p role="status">{favorites.length} quán đã lưu</p><section className="restaurant-result-grid" aria-label="Quán đã lưu">
        {favorites.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} onOpen={() => navigate(`/restaurant/${restaurant.id}`)} />)}
      </section></> : <section className="route-empty"><p>Bạn chưa lưu quán nào.</p><Link className="btn secondary" to="/kham-pha">Khám phá quán</Link></section>}
  </main>;
}
