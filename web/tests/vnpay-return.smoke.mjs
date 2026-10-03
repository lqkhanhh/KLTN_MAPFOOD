import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let status = 'PENDING', invalid = false;
  await page.route('**/api/**', route => {
    if (route.request().url().includes('/payments/vnpay-return')) return route.fulfill(invalid
      ? { status: 400, json: { message: 'Chữ ký không hợp lệ' } }
      : { json: { orderId: 'test-order', status, providerStatus: 'PAID' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('http://127.0.0.1:4173/payment/vnpay-return?vnp_ResponseCode=00');
  await page.getByRole('heading', { name: 'Đang xác nhận thanh toán…' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Thanh toán thành công' }).count(), 0);
  status = 'PAID';
  await page.getByRole('heading', { name: 'Thanh toán thành công' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Xem đơn hàng', exact: true }).getAttribute('href'), '/orders/test-order');
  status = 'CANCELLED'; await page.reload();
  await page.getByRole('heading', { name: 'Thanh toán chưa hoàn tất' }).waitFor();
  invalid = true; await page.reload();
  await page.getByRole('heading', { name: 'Chưa xác minh được thanh toán' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Xem đơn hàng', exact: true }).count(), 0);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: pending does not trust success URL; confirmed, cancelled, invalid signature; mobile/desktop. Mock HTTP, no bank transaction.');
} finally { await browser.close(); }
