import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const imageUrl = 'https://res.cloudinary.com/demo/image/upload/test.png';
let failure = false; let uploads = 0;
let shop = { id: 'A', name: 'Quán ảnh', address: 'TP.HCM', openingHours: '08:00-22:00', location: { coordinates: [106.7, 10.8] }, active: true, imageUrl: 'https://example.com/old.png', menuItems: [{ id: 'food', name: 'Cơm', price: 50000, available: true, imageUrl: '' }] };
const errors = [];
async function pageFor(configured) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((configured) => {
    Object.defineProperty(window, 'ROUTEBITE_CONFIG', { value: { apiBase: 'http://127.0.0.1:3000/api', cloudinaryCloudName: configured ? 'demo' : '', cloudinaryUploadPreset: configured ? 'fixture' : '' }, writable: false });
    localStorage.setItem('routebite_access_token', 'test-token'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'merchant', role: 'merchant', fullName: 'Chủ quán ảnh' }));
  }, configured);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4173') return route.continue();
    if (url.hostname === 'api.cloudinary.com') {
      uploads++; const data = route.request().postDataBuffer().toString(); assert.ok(data.includes('fixture')); assert.ok(data.includes('upload_preset')); assert.ok(!data.includes('api_secret'));
      return failure ? route.fulfill({ status: 400, json: { error: { message: 'Invalid preset' } } }) : route.fulfill({ json: { secure_url: imageUrl } });
    }
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: pixel });
    if (url.pathname === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (url.pathname === '/api/restaurants/mine') return route.fulfill({ json: [shop] });
    if (url.pathname === '/api/restaurants/A' && route.request().method() === 'PUT') {
      const dto = route.request().postDataJSON(); shop = { ...shop, ...dto }; return route.fulfill({ json: shop });
    }
    if (url.pathname === '/api/restaurants/A') return route.fulfill({ json: shop });
    if (url.pathname === '/api/restaurants') return route.fulfill({ json: { data: [shop], total: 1 } });
    if (url.pathname === '/api/orders') return route.fulfill({ json: [] });
    return route.abort();
  });
  return page;
}
try {
  const page = await pageFor(true); await page.goto('http://127.0.0.1:4173/merchant/dashboard');
  const file = page.getByLabel('Chọn ảnh đại diện quán', { exact: true }); await file.waitFor();
  await file.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
  await page.getByText('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.').waitFor(); assert.equal(uploads, 0);
  await file.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }); assert.equal(uploads, 0);
  failure = true;
  await file.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: pixel }); await page.getByText('Tải ảnh thất bại.', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('URL ảnh đại diện quán').inputValue(), 'https://example.com/old.png');
  failure = false; await file.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: pixel });
  await page.waitForFunction((url) => document.querySelector('[aria-label="URL ảnh đại diện quán"]')?.value === url, imageUrl);
  await page.getByRole('button', { name: 'Lưu ảnh quán', exact: true }).click(); await page.getByText('Đã lưu ảnh đại diện quán.').waitFor(); assert.equal(shop.imageUrl, imageUrl);
  await page.goto('http://127.0.0.1:4173/kham-pha'); await page.locator('.restaurant-search-card').waitFor(); assert.equal(await page.locator('.restaurant-search-card img').getAttribute('src'), imageUrl);
  await page.goto('http://127.0.0.1:4173/merchant/menu'); await page.getByLabel('Chọn ảnh món 1', { exact: true }).setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: pixel });
  await page.waitForFunction((url) => document.querySelector('[aria-label="URL ảnh món 1"]')?.value === url, imageUrl);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await page.getByText('Đã lưu menu thành công.').waitFor(); assert.equal(shop.menuItems[0].imageUrl, imageUrl);
  await page.goto('http://127.0.0.1:4173/restaurant/A'); await page.getByRole('img', { name: 'Cơm', exact: true }).waitFor(); assert.equal(await page.getByRole('img', { name: 'Cơm', exact: true }).getAttribute('src'), imageUrl);
  await page.getByRole('button', { name: 'Thêm Cơm', exact: true }).click(); await page.getByRole('link', { name: /Xem giỏ hàng/ }).click(); assert.equal(await page.getByRole('img', { name: 'Cơm', exact: true }).getAttribute('src'), imageUrl);
  await page.getByRole('link', { name: '← Giỏ hàng của tôi' }).click(); assert.equal(await page.locator('.rb-saved-cart img').getAttribute('src'), imageUrl);
  const missing = await pageFor(false); await missing.goto('http://127.0.0.1:4173/merchant/dashboard'); await missing.getByText('Chưa cấu hình Cloudinary', { exact: false }).waitFor();
  assert.equal(await missing.getByLabel('Chọn ảnh đại diện quán', { exact: true }).isDisabled(), true);
  await missing.getByLabel('URL ảnh đại diện quán').fill('https://example.com/manual.png'); await missing.getByRole('button', { name: 'Lưu ảnh quán', exact: true }).click(); await missing.getByText('Đã lưu ảnh đại diện quán.').waitFor();
  assert.equal(shop.imageUrl, 'https://example.com/manual.png');
  assert.deepEqual(errors, []);
  console.log('PASS: configured/missing Cloudinary, MIME + size checks, failure preserves old URL, upload + save cover/menu, image on Explore/menu/cart/saved carts, manual URL fallback.');
} finally { await browser.close(); }
