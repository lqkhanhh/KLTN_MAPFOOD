import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from './api';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import RestaurantCard from './components/RestaurantCard';
import { ReorderSuggestions } from './components/ReorderSuggestions';
import LocationAutocomplete from './components/LocationAutocomplete';
import { routeQuery } from './utils/routeContext';

const QUICK_CATEGORIES = [
  { label: 'Cà phê', value: 'ca-phe' }, { label: 'Cơm', value: 'com' },
  { label: 'Bún/Phở', value: 'bun-pho' }, { label: 'Đồ uống', value: 'do-uong' },
  { label: 'Ăn vặt', value: 'an-vat' },
];
const emptyPoint = (address = '') => ({ address, lat: null, lng: null });

export default function Home() {
  const navigate = useNavigate();
  const { getCurrentLocation, loading: locating, error: locationError } = useCurrentLocation();
  const [startPoint, setStartPoint] = useState(emptyPoint());
  const [endPoint, setEndPoint] = useState(emptyPoint());
  const [restaurants, setRestaurants] = useState([]);
  const [resultOrigin, setResultOrigin] = useState(undefined);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [mapTarget, setMapTarget] = useState(null);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    const query = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : '';
    setResultOrigin(undefined);
    request(`/restaurants${query}`, { authorized: false })
      .then((response) => setRestaurants(Array.isArray(response) ? response : response.data || []))
      .catch(() => setRestaurants([]));
  }, [activeCategory]);
  useEffect(() => { if (locationError) setMessage(locationError); }, [locationError]);

  async function geocode(point, label) {
    if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) return point;
    if (!point.address.trim()) throw new Error(`Vui lòng nhập ${label}.`);
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', 'accept-language': 'vi', q: point.address });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const rows = await response.json();
    if (!rows?.[0]) throw new Error(`Không tìm thấy ${label.toLowerCase()}.`);
    return { address: rows[0].display_name || point.address, lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
  }
  async function useLocation() { try { setStartPoint(await getCurrentLocation()); } catch { /* Hook đặt thông báo. */ } }
  async function search(event) {
    event.preventDefault(); setSearching(true); setSearched(true); setMessage('');
    try {
      const [pointA, pointB] = await Promise.all([geocode(startPoint, 'điểm đi'), geocode(endPoint, 'điểm đến')]);
      setStartPoint(pointA); setEndPoint(pointB);
      const result = await request('/search/route', { method: 'POST', authorized: false, body: { pointA: { latitude: pointA.lat, longitude: pointA.lng }, pointB: { latitude: pointB.lat, longitude: pointB.lng }, radius: 500 } });
      const eta = Number(result.route?.travelTimeMinutes);
      setResultOrigin(pointA);
      if (Number.isFinite(eta) && eta > 0) localStorage.setItem('routebite_route_eta_minutes', String(eta));
      setRestaurants(result.restaurants || []); setMessage(`Đã tìm theo tuyến đường · thời gian di chuyển khoảng ${eta || '?'} phút.`);
    } catch (error) { setRestaurants([]); setMessage(error.message || 'Có lỗi khi tìm quán, vui lòng thử lại.'); } finally { setSearching(false); }
  }
  const heading = searched ? 'Kết quả gợi ý trên tuyến' : 'Quán nổi bật';
  return <main className="route-home">
    <section className="route-hero">
      <div className="route-hero-copy"><p>HÀNH TRÌNH ẨM THỰC</p><h1>Tìm quán trên đường đi.</h1><span>Chọn điểm đi và điểm đến. RouteBite sẽ gợi ý điểm dừng phù hợp trong phạm vi lệch tuyến 500m.</span></div>
      <form className="route-form" onSubmit={search}>
        <div className="route-field"><label>Điểm đi</label><LocationAutocomplete value={startPoint} placeholder="Nhập điểm xuất phát" onChange={setStartPoint} onSelect={setStartPoint}><button type="button" onClick={() => setMapTarget('start')}>Chọn trên bản đồ</button><button className="location-action" type="button" disabled={locating} onClick={useLocation}>{locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}</button></LocationAutocomplete></div>
        <div className="route-field"><label>Điểm đến</label><LocationAutocomplete value={endPoint} placeholder="Nhập điểm đến" onChange={setEndPoint} onSelect={setEndPoint}><button type="button" onClick={() => setMapTarget('end')}>Chọn trên bản đồ</button></LocationAutocomplete></div>
        <button className="route-submit" disabled={searching}>{searching ? 'Đang tìm…' : 'Tìm gợi ý'}</button>
      </form>
    </section>
    <section className="route-categories"><h2>Danh mục nhanh</h2><div><button type="button" className={!activeCategory ? 'active' : ''} onClick={() => { setActiveCategory(''); setSearched(false); }}>Tất cả</button>{QUICK_CATEGORIES.map((category) => <button type="button" className={activeCategory === category.value ? 'active' : ''} key={category.value} onClick={() => { setActiveCategory(category.value); setSearched(false); }}>{category.label}</button>)}</div></section>
    <section className="route-results"><div className="route-results-heading"><div><p>{searched ? 'TÌM THEO LỘ TRÌNH' : 'KHÁM PHÁ GẦN BẠN'}</p><h2>{heading}</h2></div>{message && <span>{message}</span>}</div>{searching ? <div className="restaurant-result-grid">{[1, 2, 3].map((item) => <div className="restaurant-skeleton" key={item} />)}</div> : restaurants.length ? <div className="restaurant-result-grid">{restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} rank={searched ? index + 1 : undefined} onOpen={() => navigate(`/restaurant/${restaurant.id}${routeQuery(resultOrigin)}`)} />)}</div> : <div className="route-empty">{searched ? 'Không tìm thấy quán phù hợp trong phạm vi 500m quanh tuyến đường này.' : 'Chưa có quán công khai để hiển thị.'}</div>}</section>
    {!searched && <ReorderSuggestions />}
    {mapTarget && <MapPicker initialCenter={mapTarget === 'start' ? startPoint : endPoint} onClose={() => setMapTarget(null)} onPick={(location) => { (mapTarget === 'start' ? setStartPoint : setEndPoint)(location); setMapTarget(null); }} />}
  </main>;
}

function MapPicker({ initialCenter, onClose, onPick }) {
  const node = useRef(null); const markerRef = useRef(null);
  const [selected, setSelected] = useState(null); const [address, setAddress] = useState(''); const [loadingAddress, setLoadingAddress] = useState(false);
  useEffect(() => {
    const L = window.L; if (!L || !node.current) return undefined;
    const center = Number.isFinite(initialCenter?.lat) ? [initialCenter.lat, initialCenter.lng] : [10.7769, 106.7009];
    const map = L.map(node.current).setView(center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    map.on('click', async (event) => {
      const location = { lat: event.latlng.lat, lng: event.latlng.lng }; setSelected(location);
      if (markerRef.current) markerRef.current.remove(); markerRef.current = L.marker([location.lat, location.lng]).addTo(map);
      setLoadingAddress(true); setAddress('');
      try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=vi&lat=${location.lat}&lon=${location.lng}`); const data = await response.json(); setAddress(data.display_name || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`); } catch { setAddress(`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`); } finally { setLoadingAddress(false); }
    });
    return () => map.remove();
  }, [initialCenter]);
  return <div className="location-map-modal" role="dialog" aria-modal="true"><section className="location-map-card"><header><div><strong>Chọn vị trí trên bản đồ</strong><span>Nhấn vào vị trí mong muốn để đặt ghim.</span></div><button type="button" onClick={onClose}>×</button></header><div className="location-map-canvas" ref={node} /><footer><p>{!selected ? 'Nhấn vào bản đồ để chọn vị trí' : loadingAddress ? 'Đang xác định địa chỉ…' : address}</p><button type="button" disabled={!selected || loadingAddress} onClick={() => onPick({ ...selected, address })}>Xác nhận vị trí</button></footer></section></div>;
}
