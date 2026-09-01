import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, TOKEN_KEY } from './api';

export const mockRestaurants = [
  { id: 'mock-com-tam', name: 'Cơm Tấm Mẫu', address: 'Quận 1, TP. Hồ Chí Minh', rating: 4.8, deviation: 'Lệch 2 phút', image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=800&q=80' },
  { id: 'mock-bun-bo', name: 'Bún Bò Huế Gia Truyền', address: 'Quận 3, TP. Hồ Chí Minh', rating: 4.7, deviation: 'Lệch 3 phút', image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80' },
  { id: 'mock-ca-phe', name: 'Cà phê Đất', address: 'Bình Thạnh, TP. Hồ Chí Minh', rating: 4.6, deviation: 'Ngay mặt tiền', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80' },
];

export default function Home() {
  const navigate = useNavigate();
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [restaurants, setRestaurants] = useState(mockRestaurants);
  const [searched, setSearched] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [mapTarget, setMapTarget] = useState(null);

  useEffect(() => { setRestaurants(mockRestaurants); }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => setStartPoint(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`));
  }
  async function pointFromInput(value) {
    const coordinates = value.split(',').map(Number);
    if (coordinates.length === 2 && coordinates.every(Number.isFinite)) return { latitude: coordinates[0], longitude: coordinates[1] };
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`);
    const rows = await response.json();
    if (!rows?.[0]) throw new Error(`Không tìm thấy địa điểm: ${value}`);
    return { latitude: Number(rows[0].lat), longitude: Number(rows[0].lon) };
  }
  async function labelFromPoint({ lat, lng }) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const place = await response.json();
    return place.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  async function search(event) { event.preventDefault(); setSearched(true); setSearchMessage(''); if (!localStorage.getItem(TOKEN_KEY)) { setSearchMessage('Vui lòng đăng nhập để tìm quán theo tuyến đường.'); return; } try { const [pointA, pointB] = await Promise.all([pointFromInput(startPoint), pointFromInput(endPoint)]); const result = await request('/search/route', { method: 'POST', body: { pointA, pointB, radius: 1200 } }); const etaMinutes = Number(result.route?.travelTimeMinutes); if (Number.isFinite(etaMinutes) && etaMinutes > 0) localStorage.setItem('routebite_route_eta_minutes', String(etaMinutes)); if (Array.isArray(result.restaurants)) setRestaurants(result.restaurants.map((row) => ({ ...row, deviation: row.distance_meters ? `Lệch ${Math.round(Number(row.distance_meters))}m` : 'Tiện đường' }))); setSearchMessage(`Đã tìm gợi ý theo tuyến (${result.route?.provider || 'backend'}) · thời gian di chuyển khoảng ${etaMinutes || '?'} phút.`); } catch (error) { setRestaurants(mockRestaurants); setSearchMessage(error.message || 'Chưa thể tìm tuyến, đang hiển thị quán mẫu.'); } }
  function swap() { const previous = startPoint; setStartPoint(endPoint); setEndPoint(previous); }

  return <main className="home-route-v2">
    <section className="home-route-hero">
      <div className="home-route-copy"><p>HÀNH TRÌNH ẨM THỰC</p><h1>Tìm quán trên đường đi.</h1><span>Chọn điểm đi và điểm đến. RouteBite sẽ gợi ý điểm dừng phù hợp.</span></div>
      <form className="home-route-form-v2" onSubmit={search}><div className="place-form">
        <label className="place-input">Điểm đi<input value={startPoint} onChange={(e) => setStartPoint(e.target.value)} placeholder="Nhập điểm xuất phát" required /><small><button type="button" onClick={() => setMapTarget('start')}>Chọn trên bản đồ</button><button type="button" onClick={useCurrentLocation}>Dùng vị trí hiện tại</button></small></label>
        <button type="button" className="swap-button" onClick={swap}>⇅</button>
        <label className="place-input">Điểm đến<input value={endPoint} onChange={(e) => setEndPoint(e.target.value)} placeholder="Nhập điểm đích" required /><small><button type="button" onClick={() => setMapTarget('end')}>Chọn trên bản đồ</button></small></label>
        <button className="route-search-button">Tìm gợi ý</button>
      </div></form>
    </section>
    <section className="quick-category-v2"><h2>Danh mục nhanh</h2><div>{['Cà phê', 'Cơm', 'Bún/Phở', 'Đồ uống', 'Ăn vặt'].map((name) => <button type="button" key={name}>{name}</button>)}</div></section>
    <section className="featured-home-v2"><div className="section-heading-v2"><h2>{searched ? 'Kết quả gợi ý' : 'Quán nổi bật gần bạn'}</h2></div>{searchMessage && <p>{searchMessage}</p>}<div className="restaurant-grid route-results-grid">{restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} onClick={() => navigate(`/restaurant/${restaurant.id}`)} />)}</div></section>
    {mapTarget && <MapPicker onClose={() => setMapTarget(null)} onPick={async ({ lat, lng }) => { try { const label = await labelFromPoint({ lat, lng }); (mapTarget === 'start' ? setStartPoint : setEndPoint)(label); } catch { (mapTarget === 'start' ? setStartPoint : setEndPoint)(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); } finally { setMapTarget(null); } }} />}
  </main>;
}

function RestaurantCard({ restaurant, onClick }) { return <article className="route-food-card" onClick={onClick}><div className="route-food-image"><img src={restaurant.image || mockRestaurants[0].image} alt={restaurant.name} /><button className="save-heart" type="button" onClick={(e) => e.stopPropagation()}>♡</button></div><div className="route-food-body"><span className="convenience-tag score-high">{restaurant.deviation || 'Tiện đường +150m'}</span><div className="route-food-title"><h3 title={restaurant.name}>{restaurant.name}</h3></div><div className="route-meta-line"><span>⭐ {restaurant.rating || 4.5}</span><span>🚗 {restaurant.deviation || 'Lệch 2 phút'}</span></div></div></article>; }

function MapPicker({ onClose, onPick }) { const node = useRef(null); useEffect(() => { const L = window.L; if (!L || !node.current) return; const map = L.map(node.current).setView([10.7769, 106.7009], 13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map); map.on('click', (event) => onPick(event.latlng)); return () => map.remove(); }, [onPick]); return <div className="location-map-modal" role="dialog"><section className="location-map-card"><div className="location-map-head"><div><strong>Chọn điểm trên bản đồ</strong><span>Nhấn vào vị trí mong muốn để chọn.</span></div><button type="button" onClick={onClose}>Đóng</button></div><div className="location-map-canvas" ref={node} /></section></div>; }
