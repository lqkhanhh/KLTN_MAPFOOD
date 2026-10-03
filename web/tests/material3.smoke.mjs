import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results/material3', { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const shop = { id: 'shop', name: 'Bếp Nhà RouteBite', address: 'Quận 1, TP. Hồ Chí Minh', rating: 4.8, reviewCount: 12, openingHours: '08:00-22:00', active: true, menuItems: [{ id: 'food', name: 'Cơm tấm sườn', price: 45000, available: true }] };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/restaurants') return route.fulfill({ json: { data: [shop], total: 1 } });
    if (path === '/api/restaurants/mine') return route.fulfill({ json: [shop] });
    if (path === '/api/restaurants/shop') return route.fulfill({ json: shop });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (path === '/api/orders' || path === '/api/messages/conversations' || path === '/api/favorites') return route.fulfill({ json: [] });
    if (path === '/api/admin/dashboard/overview') return route.fulfill({ json: { usersByRole: [], totalRestaurants: 1, totalOrders: 0, gmv: 0, newUsersThisMonth: 0, topRestaurants: [] } });
    if (path === '/api/admin/search-analytics') return route.fulfill({ json: { totalSearches: 0, popularOriginAreas: [] } });
    return route.fulfill({ json: { data: [], total: 0 } });
  });
  for (const [name, path, role] of [['home','/',null], ['login','/login',null], ['menu','/restaurant/shop',null], ['merchant','/merchant/dashboard','merchant'], ['admin','/admin/overview','admin']]) {
    await page.goto('http://127.0.0.1:4173');
    await page.evaluate(role => {
      localStorage.clear();
      if (role) { localStorage.setItem('routebite_access_token', 'design-fixture'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'fixture', fullName: 'Người kiểm thử', role })); }
    }, role);
    await page.goto('http://127.0.0.1:4173' + path);
    await page.locator(name === 'merchant' ? '.rb-merchant-metrics' : name === 'admin' ? '.rb-admin-metrics' : name === 'menu' ? '.rb-menu-list' : name === 'login' ? '.auth-form' : '.restaurant-search-card').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-design'), 'material3');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim()), '#9b432b');
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: `test-results/material3/${name}-${width}.png`, fullPage: true });
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, elements: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ className: String(e.className), right: e.getBoundingClientRect().right })).slice(0, 12) }));
      assert.ok(overflow.width <= overflow.viewport + 1, `${name}: overflow at ${width}: ${JSON.stringify(overflow)}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: Material 3 tokens, customer/auth/menu/merchant/admin surfaces at 320/375/1440px, no horizontal page overflow or runtime errors.');
} finally { await browser.close(); }
