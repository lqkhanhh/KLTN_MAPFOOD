import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../utils/googleMaps';

export function GoogleMap({ points = [], polyline, focusPoint, onPick, onOpen, className = 'rb-explore-map' }) {
  const node = useRef(null), map = useRef(null), pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, listener;
    const authError = () => setError('Google Maps từ chối khóa truy cập. Vui lòng kiểm tra cấu hình.');
    window.addEventListener('routebite:maps-auth-error', authError);
    setError(''); setReady(false);
    loadGoogleMaps().then(async maps => {
      const { Map } = await maps.importLibrary('maps');
      await maps.importLibrary('marker'); await maps.importLibrary('geometry');
      if (!active) return;
      map.current = new Map(node.current, { center: { lat: 10.8408, lng: 106.6685 }, zoom: 13, mapId: 'DEMO_MAP_ID', gestureHandling: 'cooperative', streetViewControl: false });
      listener = map.current.addListener('click', event => { if (event.latLng) pick.current?.({ lat: event.latLng.lat(), lng: event.latLng.lng() }); });
      setReady(true);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; listener?.remove(); window.removeEventListener('routebite:maps-auth-error', authError); map.current = null; };
  }, [retry]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const maps = window.google.maps, bounds = new maps.LatLngBounds(), markers = [];
    const info = new maps.InfoWindow();
    for (const point of points) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
      const position = { lat: point.lat, lng: point.lng }; bounds.extend(position);
      const marker = new maps.marker.AdvancedMarkerElement({ map: map.current, position, title: point.name || 'Vị trí đã chọn' }); markers.push(marker);
      if (point.id && onOpen) marker.addListener('click', () => {
        const content = document.createElement('div'), title = document.createElement('strong'), button = document.createElement('button');
        title.textContent = point.name; button.textContent = 'Xem quán'; button.type = 'button'; button.onclick = () => onOpen(point.id);
        content.append(title, document.createElement('br'), button); info.setContent(content); info.open({ map: map.current, anchor: marker });
      });
    }
    let line;
    if (polyline) { const path = maps.geometry.encoding.decodePath(polyline); path.forEach(p => bounds.extend(p)); line = new maps.Polyline({ map: map.current, path, strokeColor: '#9b432b', strokeWeight: 5 }); }
    if (!bounds.isEmpty()) map.current.fitBounds(bounds, 40);
    const idle = map.current.addListener('idle', () => { if (map.current?.getZoom() > 16) map.current.setZoom(16); });
    return () => { idle.remove(); info.close(); markers.forEach(marker => { maps.event.clearInstanceListeners(marker); marker.map = null; }); line?.setMap(null); };
  }, [ready, points, polyline, onOpen]);
  useEffect(() => {
    if (ready && map.current && focusPoint) { map.current.panTo({ lat: focusPoint.lat, lng: focusPoint.lng }); map.current.setZoom(15); }
  }, [ready, focusPoint]);
  return <div><div ref={node} className={className} aria-label="Bản đồ Google Maps" />{error && <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Thử tải lại bản đồ</button></p>}</div>;
}
