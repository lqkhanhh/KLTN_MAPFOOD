import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Kiểm thử storage FIFO bằng cùng mã được bundle vào ứng dụng.
const compiled = await build({ entryPoints: ['src/utils/cartStorage.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { addCartItem, changeCartItem } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
let saved = [];
for (let i = 0; i < 11; i++) saved = addCartItem(saved, { id: 'food' + i, restaurantId: 'r' + i, name: 'Món', price: 1000, quantity: 1 });
assert.equal(saved.length, 10);
assert.equal(saved[0].restaurantId, 'r10');
assert.equal(saved.at(-1).restaurantId, 'r1');
saved = changeCartItem(saved, 'r10', 'food10', -1);
assert.equal(saved.length, 9);

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const apiCalls = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const restaurant = (id) => ({ id, name: 'Quán ' + id, address: 'TP.HCM', menuItems: [{ id: 'food-' + id, name: 'Món ' + id, price: 50000, available: true }] });
let orders = [{ id: 'pending', orderCode: 'Đơn P', userId: 'customer', status: 'PENDING', restaurant: restaurant('A'), items: [], totalAmount: 50000, createdAt: new Date().toISOString() },
  { id: 'confirmed', orderCode: 'Đơn C', userId: 'customer', status: 'CONFIRMED', restaurant: restaurant('B'), items: [], totalAmount: 50000, createdAt: new Date().toISOString() }];
await page.addInitScript(() => {
  localStorage.setItem('routebite_access_token', 'test-token');
  localStorage.setItem('routebite_user', JSON.stringify({ role: 'customer', fullName: 'Khách thử nghiệm' }));
  // Chỉ cài giỏ cũ lần đầu để xác nhận nâng cấp không làm mất món.
  if (!localStorage.getItem('fixture-initialized')) {
    localStorage.setItem('routebite_cart', JSON.stringify([{ id: 'food-A', name: 'Món A', price: 50000, quantity: 2, restaurantId: 'A', restaurantName: 'Quán A' }]));
    localStorage.setItem('fixture-initialized', '1');
  }
});
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.port === '4173') return route.continue();
  if (!url.pathname.startsWith('/api/')) return route.abort();
  const path = url.pathname;
  const method = route.request().method();
  apiCalls.push(method + ' ' + path);
  if (path.startsWith('/api/restaurants/')) return route.fulfill({ json: restaurant(path.split('/').at(-1)) });
  if (path === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
  if (path === '/api/orders' && method === 'POST') {
    assert.equal(route.request().postDataJSON().restaurantId, 'A');
    return route.fulfill({ json: { id: 'created', orderCode: 'Đơn mới' } });
  }
  if (path === '/api/orders' && method === 'GET') return route.fulfill({ json: orders });
  if (path === '/api/orders/pending/status') {
    assert.equal(method, 'PATCH');
    assert.deepEqual(route.request().postDataJSON(), { status: 'CANCELLED' });
    orders[0] = { ...orders[0], status: 'CANCELLED' };
    return route.fulfill({ json: orders[0] });
  }
  if (path === '/api/orders/confirmed') return route.fulfill({ json: orders[1] });
  if (path === '/api/auth/change-password') {
    const dto = route.request().postDataJSON();
    assert.equal(method, 'PATCH');
    return dto.oldPassword === 'wrong-password'
      ? route.fulfill({ status: 400, json: { message: 'Mật khẩu hiện tại không đúng' } })
      : route.fulfill({ json: { message: 'Đổi mật khẩu thành công!' } });
  }
  return route.fulfill({ status: 404, json: { message: 'Không có fixture' } });
});
const assertText = async (locator, value) => { await locator.waitFor(); assert.match(await locator.textContent(), value); };
try {
  await page.goto('http://127.0.0.1:4173/my-carts');
  await assertText(page.locator('.rb-saved-cart'), /Quán A.*2 món/s);
  await page.goto('http://127.0.0.1:4173/restaurant/B');
  await page.getByRole('button', { name: 'Thêm Món B', exact: true }).click();
  await page.getByRole('link', { name: 'Giỏ của tôi (2)', exact: true }).click();
  assert.equal(await page.locator('.rb-saved-cart').count(), 2);
  await page.reload();
  assert.equal(await page.locator('.rb-saved-cart').count(), 2);
  await page.locator('.rb-saved-cart').filter({ hasText: 'Quán A' }).click();
  assert.ok(page.url().endsWith('/restaurants/A/cart'));
  await assertText(page.locator('.rb-cart-items'), /Món A/);
  assert.doesNotMatch(await page.locator('.rb-cart-items').textContent(), /Món B/);
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await assertText(page.getByRole('status'), /Đơn mới/);
  await page.getByRole('link', { name: '← Giỏ hàng của tôi' }).click();
  assert.equal(await page.locator('.rb-saved-cart').count(), 1);
  await assertText(page.locator('.rb-saved-cart'), /Quán B/);
  await page.getByRole('button', { name: 'Quản lý', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa giỏ Quán B' }).click();
  await assertText(page.locator('main'), /Bạn chưa có giỏ hàng nào/);

  await page.goto('http://127.0.0.1:4173/my-orders');
  await page.getByRole('button', { name: 'Hoàn thành (0)' }).click();
  await assertText(page.locator('main'), /Bạn chưa có đơn hàng hoàn thành/);
  const callsBefore = apiCalls.filter((call) => call === 'GET /api/orders').length;
  await page.getByRole('button', { name: 'Đang xử lý (2)' }).click();
  assert.equal(await page.getByRole('button', { name: 'Hủy đơn', exact: true }).count(), 1);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
  assert.equal(apiCalls.filter((call) => call.includes('/status')).length, 0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
  await page.getByRole('button', { name: 'Đã hủy (1)' }).waitFor();
  assert.equal(await page.locator('.rb-order-card').count(), 1);
  assert.equal(apiCalls.filter((call) => call === 'GET /api/orders').length, callsBefore);
  await page.getByRole('button', { name: 'Đã hủy (1)' }).click();
  await assertText(page.locator('.rb-order-status'), /Đã hủy/);
  await page.getByRole('button', { name: 'Đang xử lý (1)' }).click();
  await page.getByRole('link', { name: 'Đơn C', exact: true }).click();
  await assertText(page.locator('h1'), /Chi tiết đơn hàng/);
  await assertText(page.locator('.rb-order-status'), /Đã xác nhận/);

  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  assert.doesNotMatch(await page.getByRole('menu').textContent(), /👤|🔒|📦|🚪|Sắp ra mắt/);
  await page.getByRole('menuitem', { name: 'Đổi mật khẩu', exact: true }).click();
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('wrong-password');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-password');
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('mismatch');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await assertText(page.getByRole('alert'), /không khớp/);
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('new-password');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await assertText(page.getByRole('alert'), /hiện tại không đúng/);
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('old-password');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await assertText(page.getByRole('status'), /Đổi mật khẩu thành công/);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await page.goto('http://127.0.0.1:4173/');
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.locator('.route-hero-copy > span').evaluate((node) => {
      const range = document.createRange(); range.selectNodeContents(node);
      return range.getClientRects().length === 1;
    }), 'Hero description must be one line');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Hero must not overflow page');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: legacy cart migration, FIFO 10 carts, multi-restaurant checkout/delete, filter counts, cancel confirmation, detail route, password modal and one-line Hero.');
} finally { await browser.close(); }
