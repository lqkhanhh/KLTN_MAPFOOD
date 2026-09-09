import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { restaurantPoint } from '../utils/routeContext';

const DEFAULT_CENTER = [10.7769, 106.7009];
export function ExploreMap({ restaurants, userPosition, locating, locationError, onLocate }) {
  const container = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const L = window.L;
    if (!L) { setMapError('Không tải được bản đồ. Bạn vẫn có thể chọn quán trong danh sách bên dưới.'); return; }
    setMapError('');
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).on('tileerror', () => setMapError('Nền bản đồ đang gián đoạn. Danh sách quán vẫn dùng được.')).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    setReady(true);
    return () => { observer.disconnect(); instance.remove(); map.current = null; layers.current = null; setReady(false); };
  }, [retry]);

  useEffect(() => {
    if (!ready || !layers.current) return;
    const L = window.L;
    layers.current.clearLayers();
    const bounds = [];
    restaurants.forEach((restaurant) => {
      const point = restaurantPoint(restaurant);
      if (!point) return;
      const coords = [point.lat, point.lng];
      bounds.push(coords);
      // Dùng textContent thay innerHTML cho dữ liệu tên/địa chỉ quán từ API.
      const content = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = restaurant.name;
      const address = document.createElement('p'); address.textContent = restaurant.address || '';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Xem quán';
      button.className = 'btn secondary'; button.onclick = () => navigate(`/restaurant/${restaurant.id}`);
      content.append(title, address, button);
      L.marker(coords, { title: restaurant.name, alt: restaurant.name, icon: L.divIcon({
        className: 'rb-shop-marker', html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15],
      }) }).bindPopup(content).addTo(layers.current);
    });
    if (userPosition) {
      const coords = [userPosition.lat, userPosition.lng]; bounds.push(coords);
      L.circleMarker(coords, { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip('Vị trí của bạn').addTo(layers.current);
    }
    if (bounds.length) map.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    else map.current.setView(DEFAULT_CENTER, 12);
  }, [ready, restaurants, userPosition, navigate]);

  const mapped = restaurants.filter((restaurant) => restaurantPoint(restaurant)).length;
  return <section className="rb-explore-map-section" aria-label="Bản đồ quán ăn">
    <div className="rb-map-toolbar"><p>{mapped} quán có vị trí trên bản đồ (trang hiện tại)</p>
      <button className="btn secondary" type="button" disabled={locating} onClick={() => {
        if (userPosition && map.current) map.current.flyTo([userPosition.lat, userPosition.lng], 15);
        else onLocate();
      }}>{locating ? 'Đang lấy vị trí…' : 'Về vị trí của tôi'}</button></div>
    <div ref={container} className="rb-explore-map" aria-label="Bản đồ OpenStreetMap" />
    {mapError && <p role="status">{mapError} <button type="button" onClick={() => {
      if (!window.L) window.location.reload(); else setRetry((value) => value + 1);
    }}>Tải lại bản đồ</button></p>}
    <p className="rb-map-note">{locationError || (userPosition ? 'Khoảng cách trên thẻ quán là đường thẳng từ vị trí của bạn, không phải quãng đường lái xe.' : 'Cho phép truy cập vị trí để xem khoảng cách từ bạn tới quán.')}</p>
  </section>;
}
