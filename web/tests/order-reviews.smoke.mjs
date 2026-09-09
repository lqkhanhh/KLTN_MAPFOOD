import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  let mode = 'success', calls = 0, release;
  const shop = { id: 'shop', name: 'Quán cơm của bạn', address: 'TP. Hồ Chí Minh', rating: 4, reviewCount: 1, menuItems: [], reviews: [] };
  const base = { userId: 'customer', restaurant: shop, items: [{ itemName: 'Cơm tấm', quantity: 1 }], totalAmount: 40000, createdAt: new Date().toISOString(), paymentMethod: 'cash', paymentStatus: 'PAID' };
  const orders = [
    { ...base, id: 'new', orderCode: 'NEW', status: 'COMPLETED', hasReview: false },
    { ...base, id: 'rated', orderCode: 'RATED', status: 'COMPLETED', hasReview: true },
    { ...base, id: 'pending', orderCode: 'PENDING', status: 'PENDING', hasReview: false },
    { ...base, id: 'cancelled', orderCode: 'CANCELLED', status: 'CANCELLED', hasReview: false },
  ];
  await page.addInitScript(() => {
    localStorage.setItem('routebite_access_token', 'test-token');
    localStorage.setItem('routebite_user', JSON.stringify({ id: 'customer', role: 'customer', fullName: 'Khách kiểm thử' }));
  });
  await page.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/orders') return route.fulfill({ json: orders });
    if (url.pathname === '/api/orders/new') return route.fulfill({ json: orders[0] });
    if (url.pathname === '/api/restaurants/shop') return route.fulfill({ json: shop });
    if (url.pathname === '/api/favorites') return route.fulfill({ json: [] });
    if (url.pathname === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
    if (url.pathname === '/api/reviews') {
      calls++; const body = req.postDataJSON();
      assert.deepEqual(Object.keys(body).sort(), ['comment', 'orderId', 'rating']);
      assert.equal(body.orderId, 'new');
      if (mode === 'network') return route.abort();
      if (mode === 'conflict') { orders[0].hasReview = true; return route.fulfill({ status: 409, json: { message: 'Đơn hàng này đã được đánh giá' } }); }
      if (mode === 'unfinished') return route.fulfill({ status: 409, json: { message: 'Chỉ có thể đánh giá sau khi đơn hàng hoàn tất' } });
      if (mode === 'delay') await new Promise((resolve) => { release = resolve; });
      const review = { ...body, id: 'review', createdAt: new Date().toISOString() };
      orders[0].hasReview = true; orders[0].review = review; shop.reviews = [review]; shop.rating = body.rating;
      return route.fulfill({ status: 201, json: review });
    }
    return route.abort();
  });
  const open = async () => { await page.getByRole('button', { name: '★ Đánh giá ngay', exact: true }).click(); await page.getByRole('dialog').waitFor(); };
  await page.goto('http://127.0.0.1:4173/my-orders');
  await page.getByRole('button', { name: '★ Đánh giá ngay', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '★ Đánh giá ngay', exact: true }).count(), 1);
  assert.equal(await page.getByText('Đã đánh giá', { exact: true }).count(), 1);
  await open(); assert.equal(new URL(page.url()).pathname, '/my-orders');
  await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Vui lòng chọn số sao' }).waitFor(); assert.equal(calls, 0);
  await page.getByRole('button', { name: '5 sao', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nhận xét (không bắt buộc)' }).fill('  Cơm ngon <script>không chạy</script>  ');
  mode = 'network'; await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Gửi đánh giá thất bại' }).waitFor();
  assert.equal(await page.getByRole('textbox').inputValue(), '  Cơm ngon <script>không chạy</script>  ');
  mode = 'delay'; await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await page.getByRole('button', { name: 'Đang gửi…', exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Để sau', exact: true }).isDisabled());
  await page.keyboard.press('Escape'); assert.ok(await page.getByRole('dialog').isVisible());
  await page.waitForTimeout(100); release();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(calls, 2); assert.equal(shop.reviews[0].comment, 'Cơm ngon <script>không chạy</script>');
  await page.reload(); await page.getByText('Đã đánh giá', { exact: true }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: '★ Đánh giá ngay', exact: true }).count(), 0);
  await page.goto('http://127.0.0.1:4173/restaurant/shop');
  await page.getByRole('heading', { name: 'Đánh giá từ khách hàng' }).waitFor();
  await page.getByText('Cơm ngon <script>không chạy</script>', { exact: true }).waitFor();
  assert.equal(await page.locator('.rb-restaurant-reviews script').count(), 0);
  await page.locator('.rb-review-average').getByText('1 đánh giá', { exact: true }).waitFor();
  assert.equal(await page.locator('.rb-review-average > strong').textContent(), '5.0/5');
  orders[0].hasReview = false; delete orders[0].review;
  await page.goto('http://127.0.0.1:4173/my-orders'); await open();
  // Modal mới phải xóa sao/nhận xét cũ, hiển thị tốt trên mobile.
  assert.equal(await page.getByRole('textbox').inputValue(), '');
  await page.getByText('Chưa chọn sao', { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 700 });
  const bounds = await page.getByRole('dialog').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await open(); await page.getByRole('button', { name: '4 sao', exact: true }).click();
  mode = 'unfinished'; await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Chỉ có thể đánh giá sau khi đơn hàng hoàn tất' }).waitFor();
  assert.equal(orders[0].hasReview, false);
  mode = 'conflict'; await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await page.getByText('Bạn đã đánh giá đơn hàng này rồi.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '★ Đánh giá ngay', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: completed-only review shortcut, modal validation/reset/mobile/Escape; safe payload, retry, double-submit protection, saved state after reload, public review, duplicate versus unfinished 409.');
} finally { await browser.close(); }
