import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { distanceMeters } from '../src/utils/distance.js';

assert.equal(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
assert.ok(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 2);
assert.equal(distanceMeters(null, { lat: 0, lng: 0 }), null);
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 10.78, longitude: 106.7 } });
  // Chạy Leaflet thật; chỉ thay ảnh nền bằng ô trống để không tải hàng loạt tile khi test.
  const leafletResponse = await context.request.get('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  assert.ok(leafletResponse.ok()); const leaflet = await leafletResponse.text();
  const cssResponse = await context.request.get('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  assert.ok(cssResponse.ok()); const leafletCss = await cssResponse.text();
  const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shop = { id: 'fixture-shop', name: 'Quán mì trộn <b>ngon</b>', address: 'TP. Hồ Chí Minh', rating: '4.8', active: true, location: { type: 'Point', coordinates: [106.701, 10.781] }, menuItems: [] };
  const second = { ...shop, id: 'fixture-second', name: 'Quán cà phê', location: { type: 'Point', coordinates: [106.704, 10.785] } };
  let saved = [], failMutation = false, delayedMutation, releaseMutation, searchCalls = [];
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.port === '4173') return route.continue();
    if (url.pathname.endsWith('/leaflet.js')) return route.fulfill({ contentType: 'application/javascript', body: leaflet });
    if (url.pathname.endsWith('/leaflet.css')) return route.fulfill({ contentType: 'text/css', body: leafletCss });
    if (url.hostname === 'tile.openstreetmap.org') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ede7dc"/></svg>' });
    if (url.pathname === '/api/restaurants') {
      assert.equal(req.headers().authorization, undefined);
      const search = url.searchParams.get('search') || ''; searchCalls.push(search);
      const rows = search === 'không có' ? [] : search ? [shop] : [shop, second];
      return route.fulfill({ json: { data: rows, total: rows.length } });
    }
    if (url.pathname === '/api/restaurants/' + shop.id) return route.fulfill({ json: shop });
    if (url.pathname === '/api/favorites') return route.fulfill({ json: saved });
    if (url.pathname.startsWith('/api/favorites/')) {
      assert.equal(req.headers().authorization, 'Bearer test-access');
      if (delayedMutation) await new Promise((resolve) => { releaseMutation = resolve; });
      if (failMutation) return route.fulfill({ status: 500, json: { message: 'Test failure' } });
      const item = url.pathname.endsWith(second.id) ? second : shop;
      saved = req.method() === 'DELETE' ? saved.filter((entry) => entry.id !== item.id) : [...saved, item];
      return route.fulfill({ json: item });
    }
    if (url.pathname === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/kham-pha');
  await page.locator('.rb-shop-marker').first().waitFor();
  assert.equal(await page.locator('.rb-shop-marker').count(), 2);
  await page.getByText(/^Cách bạn /).first().waitFor();
  await page.getByRole('button', { name: 'Về vị trí của tôi' }).click();
  await page.locator('.rb-shop-marker').first().click();
  assert.equal(await page.locator('.leaflet-popup-content strong').textContent(), shop.name);
  assert.equal(await page.locator('.leaflet-popup-content b').count(), 0);
  await page.getByRole('button', { name: 'Xem quán', exact: true }).click();
  await page.waitForURL('**/restaurant/' + shop.id);
  await page.goto('http://127.0.0.1:4173/kham-pha');
  await page.getByRole('button', { name: 'Lưu ' + shop.name, exact: true }).click();
  await page.waitForURL('**/login');
  await page.evaluate(() => {
    localStorage.setItem('routebite_access_token', 'test-access');
    localStorage.setItem('routebite_user', JSON.stringify({ id: 'customer-a', role: 'customer', fullName: 'Khách kiểm thử' }));
  });
  await page.goto('http://127.0.0.1:4173/kham-pha');
  await page.locator('.rb-shop-marker').first().waitFor();
  searchCalls = [];
  const input = page.getByPlaceholder('Tìm quán, món ăn...');
  await input.fill('mì'); await input.fill('mì trộn');
  await page.waitForResponse((res) => new URL(res.url()).searchParams.get('search') === 'mì trộn');
  await page.waitForFunction(() => document.querySelectorAll('.rb-shop-marker').length === 1);
  assert.deepEqual(searchCalls, ['mì trộn']);
  delayedMutation = true;
  await page.getByRole('button', { name: 'Lưu ' + shop.name, exact: true }).click();
  const pressed = page.getByRole('button', { name: 'Bỏ lưu ' + shop.name, exact: true });
  await pressed.waitFor(); assert.equal(await pressed.getAttribute('aria-pressed'), 'true');
  assert.ok(await pressed.isDisabled());
  await page.waitForTimeout(100); releaseMutation(); delayedMutation = false;
  await page.waitForFunction(() => !document.querySelector('.restaurant-save').disabled);
  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  await page.getByRole('menuitem', { name: 'Quán đã lưu', exact: true }).click();
  await page.getByRole('heading', { name: 'Quán đã lưu' }).waitFor();
  assert.equal(await page.locator('.restaurant-search-card').count(), 1);
  await page.reload(); await pressed.waitFor();
  failMutation = true; await pressed.click();
  await page.getByRole('alert').filter({ hasText: 'hoàn tác' }).waitFor();
  await pressed.waitFor(); assert.equal(saved.length, 1);
  failMutation = false; await pressed.click();
  await page.getByText('Bạn chưa lưu quán nào.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Khám phá quán', exact: true }).click();
  await input.fill('không có'); await page.getByText('Không tìm thấy quán hoặc món ăn phù hợp', { exact: false }).waitFor();
  assert.equal(await page.locator('.rb-shop-marker').count(), 0);
  await page.getByRole('button', { name: 'Xóa tìm kiếm' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.rb-shop-marker').length === 2);
  for (const [width, columns] of [[375, 2], [1280, 3]]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.restaurant-result-grid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length), columns);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  // Từ chối GPS không làm mất bản đồ hoặc các quán.
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1, PERMISSION_DENIED: 1 }); });
  await page.reload(); await page.getByText('Bạn cần cho phép truy cập vị trí', { exact: false }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.rb-shop-marker').length === 2);
  assert.equal(await page.getByText(/^Cách bạn /).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: real Leaflet markers/popup routing/safe text/recenter; geolocation + distance + denial; debounced search/empty; guest login; optimistic favorite/persistence/remove/rollback; responsive grid.');
} finally { await browser.close(); }
