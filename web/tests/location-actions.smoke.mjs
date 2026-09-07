import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Giả lập dịch vụ địa điểm, không gửi truy vấn tới OpenStreetMap khi kiểm thử.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 10.78, longitude: 106.7 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4173') return route.continue();
    if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: url.pathname === '/reverse'
      ? { display_name: 'Vị trí kiểm thử, TP.HCM' }
      : [{ place_id: 1, display_name: 'Nhà thờ Đức Bà, TP.HCM', lat: '10.779', lon: '106.699' }] });
    if (url.pathname === '/api/restaurants') return route.fulfill({ json: [] });
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/');
  assert.doesNotMatch(await page.locator('.route-form').textContent(), /📍|🎯|⌛/);
  for (const width of [1440, 1280, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const field of await page.locator('.route-field').all()) {
      const input = await field.locator('input').boundingBox();
      assert.ok(input.width >= 70, `Usable input at ${width}px`);
      for (const button of await field.locator('.location-input-actions button').all()) {
        const box = await button.boundingBox();
        assert.ok(Math.abs(box.y + box.height / 2 - input.y - input.height / 2) < 2, `Same row at ${width}px`);
        assert.ok(box.x >= input.x + input.width && box.x + box.width <= width, `No overlap at ${width}px`);
      }
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`);
  }
  const start = page.getByPlaceholder('Nhập điểm xuất phát');
  await start.fill('Nhà thờ');
  await page.getByRole('option', { name: /Nhà thờ Đức Bà/ }).click();
  assert.equal(await start.inputValue(), 'Nhà thờ Đức Bà, TP.HCM');
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[placeholder="Nhập điểm xuất phát"]').value === 'Vị trí kiểm thử, TP.HCM');
  await page.getByPlaceholder('Nhập điểm đến').fill('Nhà thờ');
  await page.getByRole('option', { name: /Nhà thờ Đức Bà/ }).click();
  for (const button of await page.getByRole('button', { name: 'Chọn trên bản đồ', exact: true }).all()) {
    await button.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: '×', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: icon-free buttons inline at 320–1440px, no overlap/overflow, autocomplete, geolocation and both map dialogs.');
} finally { await browser.close(); }
