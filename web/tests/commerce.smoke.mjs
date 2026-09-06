import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Dữ liệu riêng trong trình duyệt test; không tạo đơn/thanh toán trong database.
const restaurant = {
  id: 'test-restaurant', name: 'Quán kiểm thử', address: 'Nguyễn Huệ, TP. Hồ Chí Minh',
  menuItems: [{ id: 'test-food', name: 'Cơm tấm sườn', price: 60000, available: true }],
};
const instant = new Date('2026-09-06T05:00:00Z');
const order = (id, status, offset = 90_000, pickupType = 'asap') => ({
  id, status, orderCode: id, restaurant, createdAt: instant.toISOString(),
  estimatedPickupAt: new Date(instant.getTime() + offset).toISOString(), pickupType,
  totalAmount: 120000, items: [{ itemName: 'Cơm tấm sườn', quantity: 2 }],
});
const orders = [order('pending', 'PENDING'), order('confirmed', 'CONFIRMED', 5000),
  order('preparing', 'PREPARING', -60000), order('ready', 'READY'),
  order('completed', 'COMPLETED'), order('cancelled', 'CANCELLED'),
  order('scheduled', 'CONFIRMED', 3600000, 'scheduled'),
  { ...order('invalid-date', 'PENDING'), estimatedPickupAt: 'invalid' }];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Ho_Chi_Minh' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  localStorage.setItem('routebite_access_token', 'isolated-test-token');
  localStorage.setItem('routebite_user', JSON.stringify({ fullName: 'Khách kiểm thử', role: 'customer' }));
});
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/restaurants/test-restaurant') return route.fulfill({ json: restaurant });
  if (path === '/api/orders') return route.fulfill({ json: orders });
  return route.fulfill({ status: 404, json: { message: 'Không có dữ liệu kiểm thử' } });
});
const text = async (locator, expected) => {
  await locator.waitFor();
  assert.equal((await locator.textContent()).trim(), expected);
};
const quantity = () => page.getByRole('group', { name: 'Số lượng Cơm tấm sườn' }).locator('span');
const card = (code) => page.locator('.rb-order-card').filter({ has: page.locator('.rb-order-code', { hasText: new RegExp('^' + code + '$') }) });
try {
  await page.goto('http://127.0.0.1:4173/restaurant/test-restaurant', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Thêm Cơm tấm sườn', exact: true }).click();
  await text(quantity(), '1');
  await page.getByRole('button', { name: 'Tăng Cơm tấm sườn', exact: true }).click();
  await text(quantity(), '2');
  await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
  await text(quantity(), '2');
  await text(page.locator('.rb-cart-total > strong'), '120.000đ');
  await page.getByRole('button', { name: 'Tăng Cơm tấm sườn', exact: true }).click();
  await text(quantity(), '3');
  await text(page.locator('.rb-cart-total > strong'), '180.000đ');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await text(quantity(), '3');
  await page.getByRole('button', { name: 'Giảm Cơm tấm sườn', exact: true }).click();
  await text(quantity(), '2');
  await page.goto('http://127.0.0.1:4173/restaurant/test-restaurant', { waitUntil: 'domcontentloaded' });
  await text(quantity(), '2');
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
    await text(quantity(), '2');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Cart must not overflow');
    for (const button of await page.locator('.rb-quantity-stepper button').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.width >= 28 && box.x >= 0 && box.x + box.width <= width);
    }
    await page.goto('http://127.0.0.1:4173/restaurant/test-restaurant', { waitUntil: 'domcontentloaded' });
    await text(quantity(), '2');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Menu must not overflow');
  }
  await page.getByRole('button', { name: 'Giảm Cơm tấm sườn', exact: true }).click();
  await page.getByRole('button', { name: 'Giảm Cơm tấm sườn', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm Cơm tấm sườn', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('routebite_cart'))), []);
  await page.clock.install({ time: instant });
  await page.goto('http://127.0.0.1:4173/my-orders', { waitUntil: 'domcontentloaded' });
  await text(card('pending').locator('.rb-order-status'), 'Chờ xác nhận');
  await text(card('confirmed').locator('.rb-order-status'), 'Đã xác nhận');
  await text(card('preparing').locator('.rb-order-status'), 'Đang chuẩn bị');
  await text(card('ready').locator('.rb-order-status'), 'Sẵn sàng lấy');
  await text(card('completed').locator('.rb-order-status'), 'Hoàn thành');
  await text(card('cancelled').locator('.rb-order-status'), 'Đã hủy');
  assert.match(await card('pending').textContent(), /Lấy sau khoảng 2 phút/);
  assert.match(await card('confirmed').textContent(), /Lấy sau khoảng 1 phút/);
  assert.match(await card('preparing').textContent(), /Có thể đã sẵn sàng/);
  assert.match(await card('scheduled').textContent(), /Hẹn lấy lúc 13:00/);
  assert.doesNotMatch(await card('completed').textContent(), /Lấy sau|ghé lấy|Hẹn lấy/);
  assert.doesNotMatch(await card('cancelled').textContent(), /Lấy sau|ghé lấy|Hẹn lấy/);
  assert.doesNotMatch(await page.locator('main').textContent(), /0 phút|NaN|Invalid Date/);
  await page.clock.fastForward(60000);
  assert.match(await card('pending').textContent(), /Lấy sau khoảng 1 phút/);
  await page.clock.fastForward(60000);
  assert.match(await card('pending').textContent(), /Có thể đã sẵn sàng/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Orders must not overflow');
  assert.equal(await page.locator('.rb-order-heading img').count(), orders.length);
  assert.deepEqual(errors, []);
  console.log('PASS: menu/cart shared quantity, totals, reload, removal, responsive 320/375/1280px, 6 status labels, scheduled/invalid/expired times and live countdown.');
} finally { await browser.close(); }
