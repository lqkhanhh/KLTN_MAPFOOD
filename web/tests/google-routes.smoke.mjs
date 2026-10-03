import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage(); const errors = []; let payload;
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.mapPaths = [];
    class Bounds { constructor() { this.points = []; } extend(p) { this.points.push(p); } isEmpty() { return !this.points.length; } }
    class Map {
      constructor(node) { this.node = node; this.zoom = 13; node.textContent = 'Google Maps test double'; }
      addListener(name, fn) { if (name === 'click') this.node.onclick = () => fn({ latLng: { lat: () => 10.84, lng: () => 106.67 } }); return { remove: () => { this.node.onclick = null; } }; }
      fitBounds() {} getZoom() { return this.zoom; } setZoom(z) { this.zoom = z; }
    }
    class Marker { addListener() {} }
    class Polyline { constructor(options) { window.mapPaths.push(options.path); } setMap() {} }
    class InfoWindow { close() {} }
    class Geocoder { async geocode(query) { return { results: [{ place_id: 'point', formatted_address: query.address || 'Selected address', geometry: { location: { lat: () => 10.84, lng: () => 106.67 } } }] }; } }
    const maps = { LatLngBounds: Bounds, Polyline, InfoWindow, marker: { AdvancedMarkerElement: Marker }, geometry: { encoding: { decodePath: value => { window.lastPolyline = value; return [{lat:10.84,lng:106.67}]; } } }, event: {clearInstanceListeners(){}}, importLibrary: async name => name === 'maps' ? {Map} : name === 'geocoding' ? {Geocoder} : {} };
    window.google = {maps};
  });
  const shop = { id: 'shop', name: 'Quán demo', latitude: 10.84, longitude: 106.67, active: true, menuItems: [] };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/search/route') {
      payload = route.request().postDataJSON();
      return route.fulfill({json:{route:{polyline:'base-route',distanceMeters:5000,travelTimeMinutes:12},restaurants:[{...shop,detourDistanceMeters:800,detourDurationSeconds:180,viaRoute:{polyline:'via-shop',distanceMeters:5800,travelTimeMinutes:15}}]}});
    }
    return route.fulfill({json:path==='/api/restaurants'?{data:[shop],total:1}:[]});
  });
  await page.goto('http://127.0.0.1:4173');
  for (const placeholder of ['Nhập điểm xuất phát','Nhập điểm đến']) {
    await page.getByPlaceholder(placeholder).fill(placeholder);
    await page.locator('.location-suggestions').getByRole('option').click();
  }
  await page.getByLabel('Phương tiện').selectOption('TWO_WHEELER');
  await page.getByRole('button',{name:'Tìm gợi ý',exact:true}).click();
  await page.getByText(/Ghé quán: thêm/).waitFor();
  assert.equal(payload.travelMode,'TWO_WHEELER');
  await page.waitForFunction(()=>window.lastPolyline==='base-route');
  await page.getByRole('button',{name:'Xem đường ghé quán',exact:true}).click();
  await page.waitForFunction(()=>window.lastPolyline==='via-shop');
  await page.getByRole('button',{name:'Xem tuyến gốc'}).click();
  await page.waitForFunction(()=>window.lastPolyline==='base-route');
  for(const width of [320,375,1440]) { await page.setViewportSize({width,height:900}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)); }
  await page.getByRole('button',{name:'Chọn trên bản đồ',exact:true}).first().click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Bản đồ Google Maps').click();
  await dialog.getByRole('button',{name:'Xác nhận vị trí'}).click();
  assert.equal(await page.getByPlaceholder('Nhập điểm xuất phát').inputValue(),'Selected address');
  assert.deepEqual(errors,[]);
  const missing = await browser.newPage();
  await missing.route('**/maps-config.json',r=>r.fulfill({json:{googleMapsApiKey:''}}));
  await missing.route('**/api/**',r=>r.fulfill({json:[]}));
  await missing.goto('http://127.0.0.1:4173/kham-pha');
  await missing.getByRole('alert').filter({hasText:'Google Maps chưa được cấu hình'}).waitFor();
  console.log('PASS: Google SDK double geocoding/map picking, vehicle payload, base/via preview, detour labels, responsive; explicit missing-key state. No real Google calls.');
} finally { await browser.close(); }
