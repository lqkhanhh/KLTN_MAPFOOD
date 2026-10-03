import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { restaurantPoint } from '../utils/routeContext';
import { GoogleMap } from './GoogleMap';
export function ExploreMap({ restaurants, userPosition, locating, locationError, onLocate }) {
  const navigate = useNavigate();
  const [focus, setFocus] = useState(null);
  useEffect(() => { if (userPosition) setFocus({ ...userPosition }); }, [userPosition]);
  const points = restaurants.map(shop => ({ ...restaurantPoint(shop), id: shop.id, name: shop.name })).filter(p => Number.isFinite(p.lat));
  if (userPosition) points.push({ ...userPosition, name: 'Vị trí của bạn' });
  return <section className="rb-explore-map-section" aria-label="Bản đồ quán ăn">
    <div className="rb-map-toolbar"><p>Các quán trên trang hiện tại</p><button className="btn secondary" type="button" disabled={locating} onClick={() => userPosition ? setFocus({ ...userPosition }) : onLocate()}>{locating ? 'Đang lấy vị trí…' : 'Về vị trí của tôi'}</button></div>
    <GoogleMap points={points} focusPoint={focus} onOpen={id => navigate(`/restaurant/${id}`)} />
    <p className="rb-map-note">{locationError || 'Khoảng cách “Cách bạn” là đường thẳng. Dùng tìm theo lộ trình để tính quãng đường chạy xe đi thêm.'}</p>
  </section>;
}
