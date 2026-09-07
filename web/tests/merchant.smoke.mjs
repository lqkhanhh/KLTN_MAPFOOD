import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const restaurant = (id) => ({ id, name: 'Quán ' + id, address: 'TP. Hồ Chí Minh', location: { type: 'Point', coordinates: [106.7, 10.8] }, openingHours: '08:00-22:00', active: true, category: 'com', menuItems: [{ id: 'food-' + id, name: 'Cơm ' + id, price: 50000, available: true }] });
let shops = [restaurant('A'), restaurant('B')]; let orderStatus = 'PENDING'; const updates = [];
async function makePage(role) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (role) await context.addInitScript((role) => { localStorage.setItem('routebite_access_token', 'fixture-token'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'merchant', role, fullName: 'Chủ quán thử nghiệm' })); }, role);
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()); if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (url.pathname === '/api/auth/login') return route.fulfill({ json: { accessToken: 'fixture-token', user: { id: 'merchant', role: 'merchant', fullName: 'Chủ quán thử nghiệm' } } });
    if (url.pathname === '/api/restaurants/mine') return route.fulfill({ json: shops });
    if (url.pathname === '/api/restaurants' && route.request().method() === 'POST') {
      const dto = route.request().postDataJSON(); assert.equal(dto.menuItems.length, 0);
      const created = { ...restaurant('C'), ...dto, id: 'C', location: { coordinates: [dto.longitude, dto.latitude] } }; shops = [created]; return route.fulfill({ json: created });
    }
    if (url.pathname.startsWith('/api/restaurants/') && route.request().method() === 'PUT') {
      const dto = route.request().postDataJSON(); updates.push(dto);
      assert.equal(dto.latitude, 10.8); assert.equal(dto.longitude, 106.7); assert.equal(dto.openingHours, '08:00-22:00');
      const id = url.pathname.split('/').at(-1); const shop = shops.find((s) => s.id === id);
      Object.assign(shop, dto, { menuItems: dto.menuItems.map((item, i) => ({ ...item, id: item.id || 'new-' + i })) }); return route.fulfill({ json: shop });
    }
    if (url.pathname === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    if (url.pathname === '/api/orders') {
      assert.ok(url.searchParams.get('restaurantId'));
      return route.fulfill({ json: [{ id: 'order', orderCode: 'ORD-TEST', status: orderStatus, totalAmount: 50000, paymentMethod: 'cash', paymentStatus: 'UNPAID', customerName: 'Khách test', estimatedPickupAt: new Date(Date.now() + 600000).toISOString(), pickupType: 'asap', items: [{ quantity: 1 }] }] });
    }
    if (url.pathname === '/api/orders/order/status') { orderStatus = route.request().postDataJSON().status; return route.fulfill({ json: { id: 'order', status: orderStatus } }); }
    return route.abort();
  });
  return page;
}
try {
  for (const [role, expected] of [[null, '/login'], ['customer', '/'], ['admin', '/admin/overview']]) {
    // Admin dùng chung lớp bố cục sidebar, nhưng không được thấy nội dung Merchant.
    const page = await makePage(role); await page.goto('http://127.0.0.1:4173/merchant/menu'); await page.waitForURL('**' + expected); assert.equal(await page.locator('.rb-merchant-shell:not(.rb-admin-shell)').count(), 0); await page.context().close();
  }
  const page = await makePage(null);
  await page.goto('http://127.0.0.1:4173/login'); await page.getByLabel('Email', { exact: true }).fill('merchant@routebite.local'); await page.getByPlaceholder('Nhập mật khẩu').fill('fixture-password');
  await page.locator('.auth-form').getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/merchant/dashboard');
  await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor(); assert.equal(await page.locator('.consumer-header').count(), 0);
  assert.equal(await page.getByRole('link', { name: '+ Thêm quán', exact: true }).count(), 0);
  assert.equal(await page.locator('a[href="/merchant/onboarding"]').count(), 0);
  await page.getByRole('link', { name: 'Quản lý Menu', exact: true }).first().click();
  await page.getByLabel('Tên món 1', { exact: true }).fill('Tên đang sửa');
  await page.getByRole('button', { name: 'Trạng thái Tên đang sửa', exact: true }).click();
  await page.getByText('Đã cập nhật trạng thái bán.', { exact: false }).waitFor();
  assert.equal(updates.at(-1).menuItems[0].name, 'Cơm A'); assert.equal(updates.at(-1).menuItems[0].available, false);
  assert.equal(await page.getByLabel('Tên món 1', { exact: true }).inputValue(), 'Tên đang sửa');
  await page.getByRole('button', { name: '+ Thêm món mới', exact: true }).click();
  await page.getByLabel('Tên món 2', { exact: true }).fill('Trà đào'); await page.getByLabel('Giá món 2', { exact: true }).fill('25000');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await page.getByText('Đã lưu menu thành công.').waitFor(); assert.equal(updates.at(-1).menuItems.length, 2);
  await page.reload(); await page.getByLabel('Tên món 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Xóa Trà đào', exact: true }).click(); await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await page.getByText('Đã lưu menu thành công.').waitFor(); assert.equal(updates.at(-1).menuItems.length, 1);
  await page.getByLabel('Quán đang quản lý', { exact: true }).selectOption('B');
  assert.equal(await page.getByLabel('Tên món 1', { exact: true }).inputValue(), 'Cơm B');
  await page.getByRole('link', { name: 'Đơn hàng', exact: true }).click();
  for (const [label, expected] of [['Xác nhận →', 'CONFIRMED'], ['Bắt đầu chuẩn bị →', 'PREPARING'], ['Sẵn sàng →', 'READY'], ['Khách đã lấy ✓', 'COMPLETED']]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await page.locator('.rb-kanban-card .rb-order-status').filter({ hasText: expected === 'COMPLETED' ? 'Hoàn thành' : expected === 'CONFIRMED' ? 'Đã xác nhận' : expected === 'PREPARING' ? 'Đang chuẩn bị' : 'Sẵn sàng lấy' }).waitFor(); assert.equal(orderStatus, expected);
  }
  await page.setViewportSize({ width: 375, height: 850 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.context().close();
  shops = []; const onboarding = await makePage('merchant'); await onboarding.goto('http://127.0.0.1:4173/merchant/dashboard'); await onboarding.waitForURL('**/merchant/onboarding');
  await onboarding.getByLabel('Tên quán', { exact: true }).fill('Quán mới'); await onboarding.getByLabel('Địa chỉ quán', { exact: true }).fill('Địa chỉ thử nghiệm');
  await onboarding.getByLabel('Vĩ độ', { exact: true }).fill('10.8'); await onboarding.getByLabel('Kinh độ', { exact: true }).fill('106.7');
  await onboarding.getByRole('button', { name: 'Tạo quán và thêm món' }).click(); await onboarding.waitForURL('**/merchant/menu');
  assert.deepEqual(errors, []);
  console.log('PASS: role guards, merchant login/dashboard, isolated sidebar, full-menu payload, immediate toggle preserves drafts, add/delete/reload, shop switching, Kanban transitions, mobile, onboarding.');
} finally { await browser.close(); }
