import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); let fail = true, posts = 0; const messages = [], errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('routebite_access_token', 'fixture'); localStorage.setItem('routebite_user', JSON.stringify({ id: 'customer', role: 'customer', fullName: 'Khách' })); });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url()); if (url.port === '4173') return route.continue();
    if (url.pathname === '/api/orders/order') return route.fulfill({ json: { id: 'order', userId: 'customer', status: 'PENDING', restaurant: { name: 'Quán thử' }, paymentMethod: 'cash', items: [], totalAmount: 0 } });
    if (url.pathname === '/api/favorites') return route.fulfill({ json: [] });
    if (url.pathname === '/api/notifications/unread-count') return route.fulfill({ json: { unreadCount: 0 } });
    if (url.pathname === '/api/orders/order/messages') {
      if (route.request().method() === 'POST') {
        posts++;
        if (fail) return route.abort();
        const message = { id: 'message', orderId: 'order', senderId: 'customer', senderRole: 'customer', content: route.request().postDataJSON().content, createdAt: new Date().toISOString() };
        messages.push(message); return route.fulfill({ json: message });
      }
      return route.fulfill({ json: messages });
    }
    // Socket cố tình không dùng được: UI vẫn phải hiển thị tin đã lưu qua POST.
    return route.abort();
  });
  await page.goto('http://127.0.0.1:4173/orders/order');
  await page.getByRole('button', { name: 'Nhắn tin với quán', exact: true }).click();
  const input = page.getByPlaceholder('Nhập tin nhắn...');
  await input.fill('  Xin thêm nước chấm  '); await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Chưa gửi được tin nhắn' }).waitFor(); assert.equal(await input.inputValue(), '  Xin thêm nước chấm  ');
  fail = false; await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await page.locator('.rb-chat-message.mine').filter({ hasText: 'Xin thêm nước chấm' }).waitFor(); assert.equal(posts, 2); assert.equal(messages.length, 1); assert.equal(await input.inputValue(), '');
  await page.getByRole('button', { name: 'Đóng trò chuyện', exact: true }).click();
  await page.getByRole('button', { name: 'Nhắn tin với quán', exact: true }).click();
  await page.locator('.rb-chat-message.mine').waitFor(); assert.equal(await page.locator('.rb-chat-message').count(), 1);
  await input.fill('   '); assert.ok(await page.getByRole('button', { name: 'Gửi', exact: true }).isDisabled());
  await input.press('Escape'); assert.equal(await page.locator('.rb-chat-drawer').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: offline socket REST fallback, failed send retains draft, retry, trimmed content, reopen persistence, blank disabled and Escape close.');
} finally { await browser.close(); }
