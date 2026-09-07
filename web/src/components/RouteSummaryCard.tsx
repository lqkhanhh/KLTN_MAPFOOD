import { useSearchParams } from 'react-router-dom';
import { readRouteOrigin, RoutePoint, validPoint } from '../utils/routeContext';

interface Props {
  restaurantName: string;
  restaurantAddress?: string;
  destination?: RoutePoint;
  origin?: RoutePoint;
}

export function RouteSummaryCard({ restaurantName, restaurantAddress, destination, origin }: Props) {
  const [params] = useSearchParams();
  const start = readRouteOrigin(params) || origin;
  if (!validPoint(start)) return null;
  const target = validPoint(destination) ? `${destination.lat},${destination.lng}` : restaurantAddress;
  const url = target ? 'https://www.google.com/maps/dir/?' + new URLSearchParams({
    api: '1', origin: `${start.lat},${start.lng}`, destination: target, travelmode: 'driving',
  }) : undefined;

  return <section className="rb-route-summary" aria-label="Lộ trình của bạn">
    <h2>LỘ TRÌNH CỦA BẠN</h2>
    <ol className="rb-route-timeline">
      <li><span className="rb-route-label">Điểm đi</span><p>{start.address || 'Điểm xuất phát'}</p></li>
      <li><span className="rb-route-label">Ghé lấy tại</span><strong>{restaurantName}</strong><p>{restaurantAddress || destination?.address || 'Đang cập nhật địa chỉ quán'}</p></li>
    </ol>
    {url && <a className="rb-route-directions" href={url} target="_blank" rel="noopener noreferrer">🧭 Chỉ đường trên Google Maps</a>}
  </section>;
}
