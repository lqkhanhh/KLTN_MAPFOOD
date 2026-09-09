import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Kiểm tra kiểu dữ liệu và nhánh JSX không thể gửi phương thức ngoài danh sách.
const compiled = await build({ entryPoints: ['src/types/checkout.ts'], bundle: true, write: false, format: 'esm' });
const { validateOrderPayload } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
assert.throws(() => validateOrderPayload({ payment: { method: 'unsupported' } }), /Tiền mặt hoặc VNPAY/);

// API/cổng thanh toán giả lập: không tạo đơn thật hoặc chuyển tiền.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  for (const scenario of ['cash', 'vnpay', 'vnpay-unconfigured']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 850 } });
    const page = await context.newPage();
    const errors = [];
    const orderBodies = [];
    const paymentBodies = [];
    const fixtureOrder = { id: 'created', orderCode: 'TEST123', status: 'PENDING', paymentStatus: 'UNPAID', paymentMethod: scenario === 'cash' ? 'cash' : 'vnpay', totalAmount: 50000 };
    page.on('pageerror', (error) => errors.push(error.message));
    await context.addInitScript(() => {
      localStorage.setItem('routebite_access_token', 'isolated-payment-test');
      localStorage.setItem('routebite_user', JSON.stringify({ fullName: 'Khách kiểm thử', role: 'customer' }));
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'payment.example.test') return route.fulfill({ contentType: 'text/html', body: '<h1>Cổng thanh toán giả lập</h1>' });
      if (url.port === '4173') return route.continue();
      const path = url.pathname;
      if (path === '/api/restaurants/test') return route.fulfill({ json: {
        id: 'test', name: 'Quán test', address: 'TP.HCM',
        menuItems: [{ id: 'food', name: 'Cơm test', price: 50000, available: true }],
      } });
      if (path === '/api/orders' && route.request().method() === 'POST') {
        orderBodies.push(route.request().postDataJSON());
        return route.fulfill({ json: fixtureOrder });
      }
      if (path === '/api/payments/create') {
        paymentBodies.push(route.request().postDataJSON());
        return scenario === 'vnpay-unconfigured'
          ? route.fulfill({ status: 503, json: { message: 'Chưa cấu hình VNPAY_TMN_CODE.' } })
          : route.fulfill({ json: { checkoutUrl: 'https://payment.example.test/checkout' } });
      }
      if (path === '/api/notifications') return route.fulfill({ json: { items: [], unreadCount: 0 } });
      if (path === '/api/orders/created') return route.fulfill({ json: fixtureOrder });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:4173/restaurant/test');
    await page.getByRole('button', { name: 'Thêm Cơm test', exact: true }).click();
    await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
    const group = page.getByRole('group', { name: 'Phương thức thanh toán', exact: true });
    assert.equal(await group.getByRole('radio').count(), 2);
    assert.deepEqual(await group.getByRole('radio').evaluateAll((radios) => radios.map((radio) => radio.value)), ['cash', 'vnpay']);
    const cash = group.getByRole('radio', { name: 'Tiền mặt khi ghé lấy' });
    const vnpay = group.getByRole('radio', { name: 'Cổng VNPAY (QR / Thẻ ATM / Visa)', exact: true });
    assert.equal(await cash.isChecked(), true);
    await vnpay.check();
    assert.equal(await cash.isChecked(), false);
    await cash.check();
    assert.equal(await vnpay.isChecked(), false);
    if (scenario !== 'cash') await vnpay.check();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: scenario === 'cash' ? 'Đặt hàng' : 'Tiếp tục đến VNPAY', exact: true }).click();
    if (scenario === 'vnpay') await page.waitForURL('https://payment.example.test/checkout');
    else {
      await page.getByRole('status').filter({ hasText: scenario === 'cash' ? 'Thanh toán tiền mặt khi ghé lấy' : 'Chưa cấu hình VNPAY_TMN_CODE' }).waitFor();
      await page.getByRole('link', { name: 'Xem chi tiết đơn' }).waitFor();
      await page.locator('.rb-order-stepper [aria-current="step"]').filter({ hasText: 'Chờ xác nhận' }).waitFor();
      assert.equal(await page.getByText('Đã thanh toán qua VNPAY.', { exact: false }).count(), 0);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('routebite_saved_carts_v1'))), []);
    }
    assert.equal(orderBodies.length, 1);
    assert.deepEqual(orderBodies[0].payment, { method: scenario === 'cash' ? 'cash' : 'vnpay' });
    assert.deepEqual(orderBodies[0].items, [{ menuItemId: 'food', quantity: 1 }]);
    assert.deepEqual(paymentBodies, scenario === 'cash' ? [] : [{ orderId: 'created' }]);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: exactly two methods, default cash, switching, payloads, cash order, VNPAY redirect, missing-config recovery, mobile layout. No real orders/payments.');
} finally { await browser.close(); }
