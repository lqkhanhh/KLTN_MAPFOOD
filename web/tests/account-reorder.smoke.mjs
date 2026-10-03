import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  let ordersCalls = 0, empty = false;
  const orders = Array.from({ length: 8 }, (_, i) => ({ id: 'order-' + i, userId: 'customer', status: 'COMPLETED', createdAt: new Date(2026, 8, i + 1).toISOString(), restaurant: { id: 'shop-' + i, name: 'Quán ' + i, address: 'TP. Hồ Chí Minh' } }));
  orders.push({ ...orders[7], id: 'duplicate', createdAt: '2026-09-09T03:00:00Z' });
  orders.push({ ...orders[0], id: 'unfinished', status: 'PENDING', restaurant: { id: 'skip', name: 'Không hiện' }, createdAt: '2026-10-01T03:00:00Z' });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url()); if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/orders') { ordersCalls++; return route.fulfill({ json: empty ? [] : orders }); }
    if (url.pathname === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    if (url.pathname === '/api/restaurants/shop-7') return route.fulfill({ json: { ...orders[7].restaurant, menuItems: [], reviews: [] } });
    if (url.pathname === '/api/favorites') return route.fulfill({ json: [] });
    if (url.pathname === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/'); assert.equal(ordersCalls, 0); assert.equal(await page.locator('.rb-reorder-suggestions').count(), 0);
  await page.evaluate(() => { localStorage.setItem('routebite_access_token', 'fixture'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'customer', role: 'customer', fullName: 'Nguyễn Văn Khách' })); });
  await page.reload(); await page.getByRole('heading', { name: 'Đặt lại từ quán quen thuộc' }).waitFor();
  const cards = page.locator('.rb-reorder-strip .restaurant-search-card'); assert.equal(await cards.count(), 6);
  assert.equal(await cards.first().locator('h3').textContent(), 'Quán 7'); assert.equal(await cards.last().locator('h3').textContent(), 'Quán 2');
  await cards.first().click(); await page.waitForURL('**/restaurant/shop-7');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('.rb-account-initials').textContent(), 'VK');
    await page.locator('.rb-account-role').getByText('Khách hàng', { exact: true }).waitFor();
    for (const name of ['Thông tin tài khoản', 'Đăng xuất']) {
      const item = page.getByRole('menuitem', { name, exact: true });
      const css = await item.evaluate((node) => ({ bg: getComputedStyle(node).backgroundColor, font: getComputedStyle(node).fontSize, after: getComputedStyle(node, '::after').content }));
      assert.equal(css.bg, 'rgba(0, 0, 0, 0)'); assert.equal(css.font, '14px'); assert.equal(css.after, 'none');
      await item.hover();
      await page.waitForFunction(({ node, bg }) => getComputedStyle(node).backgroundColor !== bg, { node: await item.elementHandle(), bg: css.bg });
      await page.mouse.move(0, 0);
      await page.waitForFunction(({ node, bg }) => getComputedStyle(node).backgroundColor === bg, { node: await item.elementHandle(), bg: css.bg });
    }
    await page.keyboard.press('Tab');
    await page.getByRole('menuitem', { name: 'Thông tin tài khoản', exact: true }).focus();
    assert.equal(await page.getByRole('menuitem', { name: 'Thông tin tài khoản', exact: true }).evaluate((node) => getComputedStyle(node).outlineStyle), 'solid');
    await page.keyboard.press('Escape');
  }
  empty = true; await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(150); assert.equal(await page.locator('.rb-reorder-suggestions').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: dropdown neutral/hover/keyboard/mobile styles, initials/role; customer-only completed-order suggestions, latest first, unique max six, menu navigation and empty hidden.');
} finally { await browser.close(); }
