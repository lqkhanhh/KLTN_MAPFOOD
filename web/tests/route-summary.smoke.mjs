import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/utils/routeContext.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { readRouteOrigin, routeQuery, restaurantPoint } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const origin = { lat: 10.77, lng: 106.69, address: 'Đường Nguyễn Huệ, số 10% & Quận 1' };
assert.deepEqual(readRouteOrigin(new URLSearchParams(routeQuery(origin))), origin);
assert.equal(readRouteOrigin(new URLSearchParams('fromLat=&fromLng=1')), undefined);
assert.equal(readRouteOrigin(new URLSearchParams('fromLat=91&fromLng=1')), undefined);
assert.equal(readRouteOrigin(new URLSearchParams('fromLat=abc&fromLng=1')), undefined);
assert.equal(readRouteOrigin(new URLSearchParams('fromLat=0&fromLng=0')).lat, 0);
assert.equal(restaurantPoint({ latitude: null, longitude: null }), undefined);

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const restaurant = (id) => ({ id, name: 'Quán ' + id, address: '12 Lê Lợi, Quận 1',
  location: { type: 'Point', coordinates: [106.7, 10.78] },
  menuItems: [{ id: 'food-' + id, name: 'Món ' + id, price: 50000, available: true }] });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.port === '4173') return route.continue();
  if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: [{ place_id: 1, display_name: origin.address, lat: String(origin.lat), lon: String(origin.lng) }] });
  if (url.pathname === '/api/restaurants') return route.fulfill({ json: { data: [restaurant('A')] } });
  if (url.pathname.startsWith('/api/restaurants/')) return route.fulfill({ json: restaurant(url.pathname.split('/').at(-1)) });
  if (url.pathname === '/api/search/route') {
    assert.equal(route.request().postDataJSON().pointA.latitude, origin.lat);
    return route.fulfill({ json: { restaurants: [restaurant('A')], route: { travelTimeMinutes: 15 } } });
  }
  return route.abort();
});

try {
  await page.goto('http://127.0.0.1:4173/');
  await page.getByPlaceholder('Nhập điểm xuất phát').fill('Nguyễn Huệ');
  await page.getByPlaceholder('Nhập điểm đích').fill('Lê Lợi');
  await page.getByRole('button', { name: 'Tìm gợi ý', exact: true }).click();
  await page.getByRole('heading', { name: 'Kết quả gợi ý trên tuyến' }).waitFor();
  await page.locator('.restaurant-search-card').click();
  assert.equal(new URL(page.url()).searchParams.get('fromAddress'), origin.address);
  await page.getByRole('button', { name: 'Thêm Món A', exact: true }).click();
  await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
  const summary = page.getByRole('region', { name: 'Lộ trình của bạn' });
  await summary.waitFor();
  assert.ok((await summary.textContent()).includes(origin.address));
  const directions = summary.getByRole('link', { name: /Chỉ đường trên Google Maps/ });
  const maps = new URL(await directions.getAttribute('href'));
  assert.equal(maps.origin, 'https://www.google.com');
  assert.equal(maps.searchParams.get('origin'), '10.77,106.69');
  assert.equal(maps.searchParams.get('destination'), '10.78,106.7');
  assert.equal(maps.searchParams.get('travelmode'), 'driving');
  assert.equal(await directions.getAttribute('target'), '_blank');
  assert.ok((await summary.boundingBox()).y < (await page.locator('.rb-cart-total').boundingBox()).y);
  await page.reload(); await summary.waitFor();
  await page.getByRole('link', { name: '← Giỏ hàng của tôi' }).click();
  await page.locator('.rb-saved-cart').click();
  assert.equal(new URL(page.url()).search, '');
  await summary.waitFor();
  assert.ok((await summary.textContent()).includes(origin.address));
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  // Vào thẳng một quán khác không được dùng nhầm điểm đi của giỏ trước.
  await page.goto('http://127.0.0.1:4173/restaurant/B');
  await page.getByRole('button', { name: 'Thêm Món B', exact: true }).click();
  await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
  assert.equal(await summary.count(), 0);
  // Chỉ đổi điểm đi, không thêm món: checkout vẫn lưu lộ trình mới vào giỏ đã có.
  const newOrigin = { lat: 0, lng: 0, address: 'Điểm đi mới' };
  await page.goto('http://127.0.0.1:4173/restaurant/A' + routeQuery(newOrigin));
  await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
  await summary.waitFor();
  await page.goto('http://127.0.0.1:4173/restaurants/A/cart');
  await summary.waitFor();
  assert.ok((await summary.textContent()).includes(newOrigin.address));
  assert.deepEqual(errors, []);
  console.log('PASS: Home → menu → checkout, per-cart route persistence, encoded addresses, Google Maps, responsive layout, no-origin hiding.');
} finally { await browser.close(); }
