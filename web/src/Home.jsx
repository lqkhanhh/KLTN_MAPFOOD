import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from './api';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import RestaurantCard from './components/RestaurantCard';
import { ReorderSuggestions } from './components/ReorderSuggestions';
import LocationAutocomplete from './components/LocationAutocomplete';
import { routeQuery } from './utils/routeContext';
import { GoogleMap } from './components/GoogleMap';
import { geocodeGoogle } from './utils/googleMaps';
import { FoodJourney } from './components/FoodJourney';

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
  const searchVersion = useRef(0);
  const [roadRoute, setRoadRoute] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVE');
  const [preview, setPreview] = useState(null);
  function changePoint(setter, point) {
    searchVersion.current++;
    setter(point); setRoadRoute(null); setPreview(null); setMessage(''); setSearching(false);
    if (searched) { setSearched(false); setRestaurants([]); }
  }
  useEffect(() => {
    const show = event => setPreview(event.detail);
    window.addEventListener('routebite:preview-route', show);
    return () => window.removeEventListener('routebite:preview-route', show);
  }, []);
  useEffect(() => { setPreview(null); }, [roadRoute]);

  useEffect(() => {
    const version = ++searchVersion.current;
    setSearching(false);
    const query = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : '';
    setResultOrigin(undefined);
    request(`/restaurants${query}`, { authorized: false })
      .then((response) => { if (version === searchVersion.current) setRestaurants(Array.isArray(response) ? response : response.data || []); })
      .catch(() => { if (version === searchVersion.current) setRestaurants([]); });
  }, [activeCategory]);
  useEffect(() => { if (locationError) setMessage(locationError); }, [locationError]);

  async function geocode(point, label) {
    if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) return point;
    if (!point.address.trim()) throw new Error(`Vui lòng nhập ${label}.`);
    const rows = await geocodeGoogle(point.address);
    if (!rows?.[0]) throw new Error(`Không tìm thấy ${label.toLowerCase()}.`);
    return { address: rows[0].display_name || point.address, lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
  }
  async function useLocation() { try { changePoint(setStartPoint, await getCurrentLocation()); } catch { /* Hook đặt thông báo. */ } }
  async function search(event) {
    const version = ++searchVersion.current;
    event.preventDefault(); setSearching(true); setSearched(true); setRoadRoute(null); setMessage('');
    try {
      const [pointA, pointB] = await Promise.all([geocode(startPoint, 'điểm đi'), geocode(endPoint, 'điểm đến')]);
      setStartPoint(pointA); setEndPoint(pointB);
      const result = await request('/search/route', { method: 'POST', authorized: false, body: { pointA: { latitude: pointA.lat, longitude: pointA.lng }, pointB: { latitude: pointB.lat, longitude: pointB.lng }, radius: 500, travelMode } });
      if (version !== searchVersion.current) return;
      setRoadRoute(result.route);
      const eta = Number(result.route?.travelTimeMinutes);
      setResultOrigin(pointA);
      if (Number.isFinite(eta) && eta > 0) localStorage.setItem('routebite_route_eta_minutes', String(eta));
      setRestaurants(result.restaurants || []); setMessage(`Đã tìm theo tuyến đường · thời gian di chuyển khoảng ${eta || '?'} phút. ${result.warning || ''}`);
    } catch (error) { if (version === searchVersion.current) { setRestaurants([]); setMessage(error.message || 'Có lỗi khi tìm quán, vui lòng thử lại.'); } } finally { if (version === searchVersion.current) setSearching(false); }
  }
  const heading = searched ? 'Kết quả gợi ý trên tuyến' : 'Quán nổi bật';
  return <main className="route-home">
    <section className="route-hero">
      <div className="route-hero-copy"><p>HÀNH TRÌNH ẨM THỰC</p><h1>Tìm quán trên đường đi.</h1><span>Chọn điểm đi và điểm đến. Tìm quán gần tuyến trong phạm vi địa lý 500 m, rồi so sánh thời gian và quãng đường chạy xe đi thêm khi ghé quán.</span></div>
      <FoodJourney />
      <label>Phương tiện <select value={travelMode} disabled={searching} onChange={event => { setTravelMode(event.target.value); setRoadRoute(null); setRestaurants([]); setSearched(false); }}><option value="DRIVE">Ô tô</option><option value="TWO_WHEELER">Xe máy</option></select></label>
      <form className="route-form" onSubmit={search}>
        <div className="route-field"><label>Điểm đi</label><LocationAutocomplete value={startPoint} placeholder="Nhập điểm xuất phát" onChange={point => changePoint(setStartPoint, point)} onSelect={point => changePoint(setStartPoint, point)}><button type="button" onClick={() => setMapTarget('start')}>Chọn trên bản đồ</button><button className="location-action" type="button" disabled={locating} onClick={useLocation}>{locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}</button></LocationAutocomplete></div>
        <div className="route-field"><label>Điểm đến</label><LocationAutocomplete value={endPoint} placeholder="Nhập điểm đến" onChange={point => changePoint(setEndPoint, point)} onSelect={point => changePoint(setEndPoint, point)}><button type="button" onClick={() => setMapTarget('end')}>Chọn trên bản đồ</button></LocationAutocomplete></div>
        <button className="route-submit" disabled={searching}>{searching ? 'Đang tìm…' : 'Tìm gợi ý'}</button>
      </form>
    </section>
    {roadRoute && <section className="rb-explore-map-section"><h2>Tuyến đường đề xuất</h2><p>{(roadRoute.distanceMeters / 1000).toFixed(1)} km · khoảng {roadRoute.travelTimeMinutes} phút chạy xe. Chưa gồm thời gian chờ và lấy món.</p>
      {preview && <p>Đang xem đường ghé {preview.restaurantName} · {(preview.distanceMeters / 1000).toFixed(1)} km · {preview.travelTimeMinutes} phút <button type="button" onClick={() => setPreview(null)}>Xem tuyến gốc</button></p>}
      <GoogleMap polyline={(preview || roadRoute).polyline} points={[startPoint, endPoint]} />
      <p>Quán được lọc trong hành lang 500 m theo địa lý quanh tuyến; tối đa 12 quán được tính đường ghé. Xếp hạng theo thời gian đi thêm, sau đó quãng đường đi thêm.</p></section>}
    <section className="route-categories"><h2>Danh mục nhanh</h2><div><button type="button" className={!activeCategory ? 'active' : ''} onClick={() => { setActiveCategory(''); setSearched(false); setRoadRoute(null); }}>Tất cả</button>{QUICK_CATEGORIES.map((category) => <button type="button" className={activeCategory === category.value ? 'active' : ''} key={category.value} onClick={() => { setActiveCategory(category.value); setSearched(false); setRoadRoute(null); }}>{category.label}</button>)}</div></section>
    <section className="route-results"><div className="route-results-heading"><div><p>{searched ? 'TÌM THEO LỘ TRÌNH' : 'KHÁM PHÁ GẦN BẠN'}</p><h2>{heading}</h2></div>{message && <span>{message}</span>}</div>{searching ? <div className="restaurant-result-grid">{[1, 2, 3].map((item) => <div className="restaurant-skeleton" key={item} />)}</div> : restaurants.length ? <div className="restaurant-result-grid">{restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} rank={searched ? index + 1 : undefined} onOpen={() => navigate(`/restaurant/${restaurant.id}${routeQuery(resultOrigin)}`)} />)}</div> : <div className="route-empty">{searched ? 'Không tìm thấy quán phù hợp trong phạm vi 500m quanh tuyến đường này.' : 'Chưa có quán công khai để hiển thị.'}</div>}</section>
    {!searched && <ReorderSuggestions />}
    {mapTarget && <MapPicker initialCenter={mapTarget === 'start' ? startPoint : endPoint} onClose={() => setMapTarget(null)} onPick={(location) => { changePoint(mapTarget === 'start' ? setStartPoint : setEndPoint, location); setMapTarget(null); }} />}
  </main>;
}

function MapPicker({ initialCenter, onClose, onPick }) {
  const requestId = useRef(0);
  const [selected, setSelected] = useState(null); const [address, setAddress] = useState(''); const [loadingAddress, setLoadingAddress] = useState(false);
  useEffect(() => () => { requestId.current++; }, []);
  return <div className="location-map-modal" role="dialog" aria-modal="true"><section className="location-map-card"><header><div><strong>Chọn vị trí trên bản đồ</strong><span>Nhấn vào vị trí mong muốn để đặt ghim.</span></div><button type="button" onClick={onClose}>×</button></header><GoogleMap className="location-map-canvas" points={selected ? [selected] : Number.isFinite(initialCenter?.lat) ? [initialCenter] : []} onPick={async location => { const id = ++requestId.current; setSelected(location); setLoadingAddress(true); try { const rows = await geocodeGoogle(location); if (id === requestId.current) setAddress(rows[0]?.display_name || `${location.lat}, ${location.lng}`); } catch { if (id === requestId.current) setAddress(`${location.lat}, ${location.lng}`); } finally { if (id === requestId.current) setLoadingAddress(false); } }} /><footer><p>{!selected ? 'Nhấn vào bản đồ để chọn vị trí' : loadingAddress ? 'Đang xác định địa chỉ…' : address}</p><button type="button" disabled={!selected || loadingAddress} onClick={() => onPick({ ...selected, address })}>Xác nhận vị trí</button></footer></section></div>;
}
