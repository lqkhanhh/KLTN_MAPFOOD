import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  let mode = 'data', reviewRequests = 0;
  const reviews = [
    { id: 'one', rating: 5, comment: 'Món ngon, phục vụ tốt!', customer: { fullName: 'Nguyễn Thị Ánh' }, createdAt: '2026-09-02T03:00:00Z' },
    { id: 'two', rating: '5', comment: '<img src=x onerror=alert(1)>', customer: { fullName: '<b>Khách thật</b>' }, createdAt: '2026-09-04T03:00:00Z' },
    { id: 'three', rating: 3, comment: '', customer: null, createdAt: '2026-09-01T03:00:00Z' },
    { id: 'four', rating: 1, comment: 'a'.repeat(1000), customer: { fullName: ' ' }, createdAt: '2026-09-03T03:00:00Z' },
  ];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4173') return route.continue();
    if (url.pathname.startsWith('/api/reviews')) { reviewRequests++; return route.abort(); }
    if (url.pathname.startsWith('/api/restaurants/')) {
      assert.equal(route.request().headers().authorization, undefined);
      if (mode === 'error') return route.fulfill({ status: 500, json: { message: 'Không tải được quán' } });
      return route.fulfill({ json: { id: url.pathname.split('/').pop(), name: 'Quán đánh giá', address: 'TP. Hồ Chí Minh',
        // Số tổng quan cố tình cũ: thống kê khối review phải tính từ mảng reviews đầy đủ.
        rating: 1, reviewCount: 99, menuItems: [{ id: 'dish', name: 'Cơm tấm', available: true, price: 40000 }], reviews: mode === 'empty' ? [] : reviews } });
    }
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/restaurant/review-shop');
  await page.getByRole('heading', { name: 'Đánh giá từ khách hàng' }).waitFor();
  assert.equal(await page.locator('.rb-review-average > strong').textContent(), '3.5/5');
  await page.locator('.rb-review-average').getByText('4 đánh giá', { exact: true }).waitFor();
  for (const [stars, percentage, count] of [[5, 50, 2], [4, 0, 0], [3, 25, 1], [2, 0, 0], [1, 25, 1]]) {
    const bar = page.getByRole('progressbar', { name: `${stars} sao`, exact: true });
    assert.equal(Number(await bar.getAttribute('aria-valuenow')), percentage);
    assert.equal(await bar.getAttribute('aria-valuetext'), `${count} đánh giá (${percentage.toFixed(1)}%)`);
    assert.equal(await bar.locator('div').evaluate((node) => node.style.width), `${percentage}%`);
  }
  const cards = page.locator('.rb-reviews-list article');
  assert.equal(await cards.count(), 4);
  assert.equal(await cards.first().locator('header strong').textContent(), '<b>Khách thật</b>');
  assert.equal(await cards.first().locator('time').textContent(), '4/9/2026');
  assert.equal(await cards.last().locator('.rb-review-stars').textContent(), '★★★☆☆');
  assert.equal(await cards.last().locator('.rb-review-text').count(), 0);
  assert.equal(await page.locator('.rb-reviews-list b, .rb-reviews-list img, .rb-reviews-list script').count(), 0);
  assert.equal(await page.locator('.rb-reviews-list').getByText('Khách hàng', { exact: true }).count(), 2);
  for (const [star, count] of [[5, 2], [4, 0], [3, 1], [2, 0], [1, 1]]) {
    const button = page.getByRole('button', { name: `${star} sao (${count})`, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await cards.count(), count);
    assert.equal(await page.locator('.rb-review-average > strong').textContent(), '3.5/5');
    if (!count) await page.getByText(`Chưa có đánh giá ${star} sao.`, { exact: true }).waitFor();
  }
  await page.getByRole('button', { name: 'Tất cả (4)', exact: true }).click();
  assert.equal(await cards.count(), 4);
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const font = await page.locator('.rb-restaurant-reviews h2').evaluate((node) => getComputedStyle(node).fontFamily);
    assert.ok(!font.includes('Playfair'));
  }
  mode = 'empty'; await page.goto('http://127.0.0.1:4173/restaurant/empty-shop');
  await page.getByText('Chưa có đánh giá nào cho quán này.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('progressbar').count(), 0);
  assert.equal(await page.locator('.rb-reviews-list article').count(), 0);
  mode = 'error'; await page.reload();
  await page.getByText('Không tải được quán', { exact: true }).waitFor();
  assert.equal(await page.locator('.rb-reviews-empty').count(), 0);
  assert.equal(reviewRequests, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: embedded/public reviews, accurate average/count/distribution, newest first, names/fallback, Vietnamese dates, safe text, optional comments, responsive layout, empty and API-error states; no extra reviews endpoint.');
} finally { await browser.close(); }
