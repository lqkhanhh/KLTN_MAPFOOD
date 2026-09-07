export interface RoutePoint { lat: number; lng: number; address: string }

export function validPoint(point: unknown): point is RoutePoint {
  const value = point as RoutePoint | null;
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}

export function readRouteOrigin(params: URLSearchParams): RoutePoint | undefined {
  const lat = params.get('fromLat');
  const lng = params.get('fromLng');
  if (!lat?.trim() || !lng?.trim()) return undefined;
  // URLSearchParams đã giải mã địa chỉ, không decodeURIComponent thêm lần nữa.
  const point = { lat: Number(lat), lng: Number(lng), address: params.get('fromAddress') || 'Điểm xuất phát' };
  return validPoint(point) ? point : undefined;
}

export function routeQuery(origin?: RoutePoint): string {
  return validPoint(origin) ? '?' + new URLSearchParams({
    fromLat: String(origin.lat), fromLng: String(origin.lng), fromAddress: origin.address || 'Điểm xuất phát',
  }).toString() : '';
}

export function restaurantPoint(restaurant: any): RoutePoint | undefined {
  const lat = restaurant?.latitude ?? restaurant?.location?.coordinates?.[1];
  const lng = restaurant?.longitude ?? restaurant?.location?.coordinates?.[0];
  if (lat == null || lng == null || lat === '' || lng === '') return undefined;
  const point = { lat: Number(lat), lng: Number(lng), address: restaurant.address || '' };
  return validPoint(point) ? point : undefined;
}
