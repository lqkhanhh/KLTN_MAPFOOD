import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let mode = 'data';
let resolvePending;
const restaurant = { id: 'test-shop', name: 'Quán kiểm thử tiếng Việt', address: 'TP. Hồ Chí Minh', rating: 4.8, menuItems: [] };
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.port === '4173') return route.continue();
  if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: [{ place_id: 1, display_name: 'Nhà thờ Đức Bà, TP. Hồ Chí Minh', lat: '10.7792', lon: '106.6991' }] });
  if (url.pathname === '/api/search/route') return route.fulfill({ json: { restaurants: [restaurant], route: { travelTimeMinutes: 20 } } });
  if (url.pathname === '/api/restaurants') {
    assert.equal(route.request().headers().authorization, undefined);
    if (mode === 'pending') await new Promise((resolve) => { resolvePending = resolve; });
    if (mode === '404') return route.fulfill({ status: 404, json: { message: 'Cannot GET /api/restaurants' } });
    if (mode === '500') return route.fulfill({ status: 500, json: { message: 'Database error' } });
    return route.fulfill({ json: mode === 'empty' ? { data: [], total: 0 }
      : mode === 'array' ? [restaurant] : { data: [restaurant], total: 1 } });
  }
  if (url.pathname === '/api/restaurants/test-shop') return route.fulfill({ json: restaurant });
  return route.abort();
});
const activeNav = async (label) => {
  const active = page.locator('.consumer-header nav .consumer-nav.active');
  await active.waitFor();
  assert.equal(await active.count(), 1);
  assert.equal(await active.textContent(), label);
  assert.equal(await active.getAttribute('aria-current'), 'page');
};
try {
  await page.goto('http://127.0.0.1:4173/');
  await activeNav('Trang chủ');
  // Ký tự UTF-8 phải đúng; font và line-height áp dụng cho cả nhãn lẫn tiêu đề.
  assert.equal(await page.locator('.route-results-heading h2').textContent(), 'Quán nổi bật');
  const font = await page.locator('.route-results-heading h2').evaluate((node) => ({ font: getComputedStyle(node).fontFamily, height: getComputedStyle(node).lineHeight }));
  assert.ok(font.font.includes('Segoe UI'));
  assert.ok(parseFloat(font.height) >= 33.6);
  await page.getByPlaceholder('Nhập điểm xuất phát').fill('Nhà thờ Đức Bà');
  await page.getByPlaceholder('Nhập điểm đến', { exact: true }).fill('Tân Thới Hiệp');
  await page.getByRole('button', { name: 'Tìm gợi ý', exact: true }).click();
  await page.getByRole('heading', { name: 'Kết quả gợi ý trên tuyến', exact: true }).waitFor();
  assert.equal(await page.locator('.route-results-heading p').textContent(), 'TÌM THEO LỘ TRÌNH');
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Khám phá' }).click();
  await activeNav('Khám phá');
  await page.locator('.restaurant-search-card').waitFor();
  assert.equal(await page.locator('.restaurant-search-card').count(), 1);
  await page.locator('.restaurant-search-card').click();
  await page.getByRole('heading', { name: restaurant.name }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/restaurant/test-shop');
  assert.equal(await page.locator('.consumer-nav.active').count(), 0);
  for (const [url, label] of [['/my-orders', 'Đơn của tôi'], ['/my-carts', 'Giỏ của tôi']]) {
    await page.goto('http://127.0.0.1:4173' + url);
    await activeNav(label);
  }
  for (const [fixture, text] of [['empty', 'Chưa có quán nào trong hệ thống.'], ['404', 'Tính năng đang được hoàn thiện'], ['500', 'Không thể tải danh sách quán']]) {
    mode = fixture;
    await page.goto('http://127.0.0.1:4173/kham-pha');
    await page.getByText(text, { exact: fixture === 'empty' }).waitFor();
    await activeNav('Khám phá');
    assert.equal(await page.locator('.restaurant-search-card').count(), 0);
  }
  mode = 'array';
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.locator('.restaurant-search-card').waitFor();
  mode = 'pending';
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Đang tải danh sách quán' }).waitFor();
  assert.equal(await page.locator('.restaurant-skeleton').count(), 6);
  mode = 'data'; resolvePending();
  await page.locator('.restaurant-search-card').waitFor();
  for (const [width, columns] of [[375, 2], [1280, 3]]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.locator('.restaurant-result-grid').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(layout, columns);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: active nav, explore data/array/loading/404/500/empty/retry, menu navigation, responsive grid and Vietnamese heading font.');
} finally { resolvePending?.(); await browser.close(); }
