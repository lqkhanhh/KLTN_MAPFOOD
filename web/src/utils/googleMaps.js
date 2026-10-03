let loading;
export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = (async () => {
    const runtime = await fetch('/maps-config.json').then(r => r.json()).catch(() => ({}));
    const key = window.ROUTEBITE_CONFIG?.googleMapsApiKey || runtime.googleMapsApiKey;
    if (!key) throw new Error('Google Maps chưa được cấu hình. Bạn vẫn có thể xem danh sách quán.');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(), 15000);
      function fail() { clearTimeout(timer); script.remove(); reject(new Error('Không tải được Google Maps. Vui lòng kiểm tra kết nối hoặc cấu hình.')); }
      window.routebiteGoogleReady = () => { clearTimeout(timer); resolve(window.google.maps); };
      window.gm_authFailure = () => { window.dispatchEvent(new Event('routebite:maps-auth-error')); fail(); };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=vi&region=VN&callback=routebiteGoogleReady`;
      script.async = true; script.onerror = fail; document.head.appendChild(script);
    });
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}
export async function geocodeGoogle(query) {
  const maps = await loadGoogleMaps();
  const { Geocoder } = await maps.importLibrary('geocoding');
  const response = await new Geocoder().geocode(typeof query === 'string' ? { address: query, region: 'vn' } : { location: { lat: query.lat, lng: query.lng } });
  return response.results.map(row => ({ place_id: row.place_id, display_name: row.formatted_address,
    lat: row.geometry.location.lat(), lon: row.geometry.location.lng() }));
}
