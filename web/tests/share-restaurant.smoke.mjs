import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.shareMode = 'native'; window.shared = null; window.copied = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => {
      if (window.shareMode === 'abort') throw new DOMException('Cancelled', 'AbortError');
      if (window.shareMode !== 'native') throw new Error('Not supported');
      window.shared = data;
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => {
      if (window.shareMode === 'manual') throw new Error('Denied');
      window.copied = value;
    } } });
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/restaurants/shop') return route.fulfill({ json: { id: 'shop', name: 'Quán cơm ngon', address: '46 Tân Thới Hiệp 29', reviews: [], menuItems: [] } });
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/restaurant/shop?fromLat=10.8&fromLng=106.7&fromAddress=private-address');
  const button = page.getByRole('button', { name: 'Chia sẻ', exact: true });
  await button.click();
  const shared = await page.evaluate(() => window.shared);
  assert.equal(shared.title, 'Quán cơm ngon');
  assert.equal(shared.url, 'http://127.0.0.1:4173/restaurant/shop');
  assert.equal(await page.evaluate(() => window.copied), null);
  await page.evaluate(() => { window.shareMode = 'abort'; }); await button.click();
  assert.equal(await page.evaluate(() => window.copied), null);
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined }); window.shareMode = 'clipboard'; });
  await button.click(); await page.getByText('Đã sao chép liên kết quán.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.copied), shared.url);
  await page.evaluate(() => { window.shareMode = 'manual'; }); await button.click();
  assert.equal(await page.getByLabel('Liên kết chia sẻ quán', { exact: true }).inputValue(), shared.url);
  const directions = page.getByRole('link', { name: 'Chỉ đường', exact: true });
  assert.ok((await directions.getAttribute('href')).startsWith('https://www.google.com/maps/dir/'));
  for (const width of [320, 375, 640, 760, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const a = await directions.boundingBox(), b = await button.boundingBox();
    assert.ok(Math.abs(a.y - b.y) < 2, `Actions not on the same row at ${width}px`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: native share, cancelled share, clipboard fallback, manual copy, private route stripped, directions retained, responsive action row.');
} finally { await browser.close(); }
