import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], payloads = []; let balance = 1, owned = [], ledger = [], paymentCalls = 0, voucherError = false;
  page.on('pageerror', (error) => errors.push(error.message));
  const reward = { id: 'reward', code: 'XU1000', title: 'Giảm 1.000đ', discountType: 'fixed', discountValue: 1000, minOrderAmount: 10000, pointsCost: 1, active: true };
  const free = { ...reward, id: 'free', code: 'FREE', title: 'Miễn phí toàn bộ', discountValue: 200000, minOrderAmount: 0, pointsCost: null };
  const restaurant = { id: 'shop', name: 'Quán kiểm thử', address: 'TP. Hồ Chí Minh', menuItems: [{ id: 'food', name: 'Cơm ngon', price: 100000, available: true }], reviews: [] };
  const admins = [reward, free];
  let lastOrder;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.port === '4173') return route.continue();
    const path = url.pathname;
    if (path === '/api/points/me') return route.fulfill({ json: { pointsBalance: balance, transactions: ledger } });
    if (path === '/api/vouchers/available') return route.fulfill({ json: [reward, free] });
    if (path === '/api/vouchers/my-vouchers') return voucherError ? route.fulfill({ status: 503, json: { message: 'Tạm gián đoạn' } }) : route.fulfill({ json: owned });
    if (path === '/api/vouchers/reward/redeem') {
      assert.equal(method, 'POST'); balance--; owned.push({ id: 'owned-reward', voucherId: reward.id, voucher: reward, usedInOrderId: null, publicClaim: false });
      ledger.push({ id: 'tx', type: 'redeem', amount: -1, createdAt: new Date().toISOString() });
      return route.fulfill({ json: { pointsBalance: balance, userVoucher: owned[0] } });
    }
    if (path === '/api/vouchers/free/claim') { owned.push({ id: 'owned-free', voucherId: free.id, voucher: free, usedInOrderId: null, publicClaim: true }); return route.fulfill({ json: { pointsBalance: balance, userVoucher: owned.at(-1) } }); }
    if (path === '/api/restaurants/shop') return route.fulfill({ json: restaurant });
    if (path === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    if (path === '/api/favorites') return route.fulfill({ json: [] });
    if (path === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
    if (path === '/api/orders' && method === 'POST') {
      const data = route.request().postDataJSON(); payloads.push(data);
      const row = owned.find((v) => v.id === data.userVoucherId); if (row) row.usedInOrderId = 'order';
      lastOrder = { id: 'order', orderCode: 'ORD-TEST', status: 'PENDING', paymentStatus: row?.voucher.id === 'free' ? 'PAID' : 'UNPAID', paymentMethod: data.payment.method, totalAmount: row?.voucher.id === 'free' ? 0 : row ? 99000 : 100000 };
      return route.fulfill({ json: lastOrder });
    }
    if (path === '/api/payments/create') { paymentCalls++; return route.fulfill({ json: { checkoutUrl: 'https://example.invalid/pay' } }); }
    if (path === '/api/orders') return route.fulfill({ json: [] });
    if (path === '/api/orders/order') return route.fulfill({ json: lastOrder });
    if (path === '/api/admin/vouchers' && method === 'POST') { const data = route.request().postDataJSON(); admins.push({ ...data, id: 'admin-new', pointsCost: null, active: true }); return route.fulfill({ json: admins.at(-1) }); }
    if (path === '/api/admin/vouchers') return route.fulfill({ json: admins });
    if (path === '/api/admin/vouchers/admin-new') { admins.at(-1).active = route.request().postDataJSON().active; return route.fulfill({ json: admins.at(-1) }); }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => { localStorage.setItem('routebite_access_token', 'fixture'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'customer', role: 'customer', fullName: 'Khách kiểm thử' })); });
  await page.goto('http://127.0.0.1:4173/my-points');
  await page.getByText('1 xu', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đổi 1 xu', exact: true }).click(); await page.getByText('0 xu', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Đổi 1 xu', exact: true }).isDisabled(), true);
  await page.reload(); await page.getByText('0 xu', { exact: true }).waitFor(); await page.getByText('-1 xu', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Nhận miễn phí' }).click(); await page.getByRole('button', { name: 'Đã nhận', exact: true }).waitFor();
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  async function addAndCheckout() { await page.goto('http://127.0.0.1:4173/restaurant/shop'); await page.getByRole('button', { name: 'Thêm Cơm ngon', exact: true }).click(); await page.getByRole('link', { name: /Xem giỏ hàng/ }).click(); await page.locator('#checkout-voucher:not(:disabled)').waitFor(); }
  await addAndCheckout(); await page.locator('#checkout-voucher').selectOption('owned-reward');
  assert.equal(await page.locator('.rb-cart-total strong').textContent(), '99.000đ');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click(); await page.getByText(/ORD-TEST đã đặt/).waitFor();
  assert.equal(payloads[0].userVoucherId, 'owned-reward'); assert.equal(payloads[0].payment.method, 'cash'); assert.ok(!('discountAmount' in payloads[0]));
  await addAndCheckout(); assert.equal(await page.locator('#checkout-voucher option[value="owned-reward"]').count(), 0);
  await page.locator('#checkout-voucher').selectOption('owned-free'); await page.getByRole('radio', { name: /Cổng VNPAY/ }).check();
  assert.equal(await page.locator('.rb-cart-total strong').textContent(), '0đ'); await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await page.getByText(/Voucher đã thanh toán toàn bộ/).waitFor(); assert.equal(paymentCalls, 0); assert.equal(payloads[1].payment.method, 'vnpay');
  voucherError = true; await addAndCheckout(); await page.getByText(/Chưa tải được voucher/).waitFor();
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click(); await page.getByText(/ORD-TEST đã đặt/).waitFor(); assert.ok(!('userVoucherId' in payloads[2]));
  voucherError = false;
  await page.evaluate(() => localStorage.setItem('routebite_user', JSON.stringify({ id: 'admin', role: 'admin', fullName: 'Quản trị' })));
  await page.goto('http://127.0.0.1:4173/admin/vouchers');
  await page.getByLabel('Mã voucher', { exact: true }).fill('WELCOME'); await page.getByLabel('Tên ưu đãi', { exact: true }).fill('Chào khách mới');
  await page.getByRole('button', { name: 'Phát hành voucher miễn phí' }).click();
  const adminCard = page.locator('.rb-voucher-grid article').filter({ hasText: 'Chào khách mới' }); await adminCard.waitFor();
  await adminCard.getByRole('button', { name: 'Ngừng hoạt động' }).click(); await adminCard.getByRole('button', { name: 'Kích hoạt', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: points/redeem/claim/history + reload, responsive widths, checkout discount payload, used voucher excluded, free VNPAY skips provider, unavailable-vouchers fallback, Admin create/toggle.');
} finally { await browser.close(); }
