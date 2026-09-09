import { useFavorites } from '../contexts/FavoritesContext';
import { restaurantPoint } from '../utils/routeContext';
import { distanceMeters, formatDistance } from '../utils/distance';
const fallbackImage = '/placeholder-food.svg';

export default function RestaurantCard({ restaurant, rank, onOpen, onSave, userPosition }) {
  const favorites = useFavorites();
  const saved = favorites?.favorites.some((entry) => entry.id === restaurant.id) || false;
  const directMeters = distanceMeters(userPosition, restaurantPoint(restaurant));
  const meters = Number(restaurant.distance_meters || 0);
  const distanceLabel = directMeters !== null ? `Cách bạn ${formatDistance(directMeters)}`
    : rank && restaurant.distance_meters != null ? `${formatDistance(meters)} tới tuyến đường` : null;
  const open = () => { if (restaurant.active !== false) onOpen?.(); };
  return <article className="restaurant-search-card" onClick={open} tabIndex="0" role="button" onKeyDown={(event) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); } }}>
    <div className="restaurant-search-image"><img src={restaurant.imageUrl || restaurant.image || fallbackImage} alt={restaurant.name} onError={(event) => { if (event.currentTarget.getAttribute('src') !== fallbackImage) event.currentTarget.src = fallbackImage; }} />{rank && <span className="restaurant-rank">#{rank}</span>}<button type="button" className="restaurant-save" aria-pressed={saved} aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${restaurant.name}`}
      disabled={favorites && (favorites.loading || !favorites.ready || favorites.pending.has(restaurant.id))}
      onClick={(event) => { event.stopPropagation(); if (onSave) onSave(restaurant.id); else favorites?.toggle(restaurant); }}>{saved ? '♥' : '♡'}</button></div>
    <div className="restaurant-search-body"><h3 title={restaurant.name}>{restaurant.name}</h3><p>{restaurant.address || 'Chưa cập nhật địa chỉ'}</p><div><span>⭐ {Number(restaurant.rating) > 0 ? restaurant.rating : 'Mới'}</span>{distanceLabel && <span title={directMeters !== null ? 'Khoảng cách đường thẳng từ vị trí của bạn' : 'Khoảng cách tới tuyến đường'}>{distanceLabel}</span>}</div>{restaurant.active === false && <small>Quán đang ngừng hoạt động</small>}</div>
  </article>;
}
