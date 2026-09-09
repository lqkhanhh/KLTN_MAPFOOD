import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Chỉ dùng API giả lập, không thay đổi trạng thái quán thật.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let suspended = false;
  let orderAttempts = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/restaurants/test') return suspended
      ? route.fulfill({ status: 403, json: { message: 'Quán đang tạm ngưng hoạt động, không thể xem menu hoặc đặt món.' } })
      : route.fulfill({ json: { id: 'test', name: 'Quán kiểm thử', active: true, address: 'TP.HCM', location: { coordinates: [106.7, 10.8] }, menuItems: [{ id: 'food', name: 'Cơm kiểm thử', price: 50000, available: true }] } });
    if (url.pathname.startsWith('/api/restaurants/mock-')) return route.fulfill({ status: 400, json: { message: 'Mã quán không hợp lệ.' } });
    if (url.pathname === '/api/orders' && route.request().method() === 'POST') orderAttempts++;
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/restaurant/test');
  await page.getByRole('button', { name: 'Thêm Cơm kiểm thử', exact: true }).click();
  await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).waitFor();
  // Giỏ đã có tọa độ vẫn phải kiểm tra lại trạng thái quán sau tải lại.
  suspended = true;
  await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Quán đang tạm ngưng' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Đặt hàng', exact: true }).isDisabled(), true);
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('routebite_saved_carts_v1')))).length, 1);
  await page.goto('http://127.0.0.1:4173/restaurant/test');
  await page.getByRole('heading', { name: 'Không mở được menu' }).waitFor();
  assert.equal(await page.locator('.rb-quantity-add').count(), 0);
  assert.equal(await page.locator('.rb-menu-cart').count(), 0);
  // Tab đã mở tự kiểm tra lại khi quay về và thu hồi menu sau đình chỉ.
  suspended = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Quán kiểm thử', exact: true }).waitFor();
  suspended = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('heading', { name: 'Không mở được menu' }).waitFor();
  await page.goto('http://127.0.0.1:4173/restaurant/mock-com-tam');
  await page.getByRole('heading', { name: 'Không mở được menu' }).waitFor();
  assert.equal(await page.getByText('Cơm Tấm Mẫu', { exact: true }).count(), 0);
  assert.equal(orderAttempts, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: suspended direct menu blocked; saved cart retained but checkout disabled; focus refresh hides stale menu; no mock fallback or order request.');
} finally { await browser.close(); }
