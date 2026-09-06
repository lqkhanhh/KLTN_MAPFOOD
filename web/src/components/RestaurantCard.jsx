const fallbackImage = 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80';

export default function RestaurantCard({ restaurant, rank, onOpen, onSave }) {
  const meters = Number(restaurant.distance_meters || 0);
  const distanceLabel = meters > 0 ? (meters < 1000 ? `${Math.round(meters)}m tới tuyến đường` : `${(meters / 1000).toFixed(1)}km tới tuyến đường`) : 'Điểm dừng tiện đường';
  return <article className="restaurant-search-card" onClick={onOpen} tabIndex="0" role="button" onKeyDown={(event) => { if (event.key === 'Enter') onOpen?.(); }}>
    <div className="restaurant-search-image"><img src={restaurant.imageUrl || restaurant.image || fallbackImage} alt={restaurant.name} />{rank && <span className="restaurant-rank">#{rank}</span>}<button type="button" className="restaurant-save" aria-label={`Lưu ${restaurant.name}`} onClick={(event) => { event.stopPropagation(); onSave?.(restaurant.id); }}>♡</button></div>
    <div className="restaurant-search-body"><h3 title={restaurant.name}>{restaurant.name}</h3><p>{restaurant.address || 'Địa điểm ẩm thực tiện đường'}</p><div><span>⭐ {restaurant.rating || 'Mới'}</span><span>🚗 {distanceLabel}</span></div></div>
  </article>;
}
