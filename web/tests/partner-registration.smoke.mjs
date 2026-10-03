import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// API và giấy tờ giả lập, không gửi CCCD/hồ sơ thật.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
let application = null, accountRole = 'customer', submissionCount = 0;
const errors = [];
const terms = { version: 'test-v1', title: 'Điều khoản đăng ký đối tác — bản tạm thời', notice: 'Không phải hợp đồng đã ký điện tử.', sections: [{ title: 'Thông tin đăng ký', text: 'Cung cấp thông tin chính xác để Admin xét duyệt.' }] };
async function openPage(role) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (role) await context.addInitScript((role) => { localStorage.setItem('routebite_access_token', 'test-session'); localStorage.setItem('routebite_user', JSON.stringify({ role, fullName: 'Người kiểm thử' })); }, role);
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()), method = route.request().method(), p = url.pathname;
    if (url.port === '4173') return route.continue();
    const body = () => route.request().postDataJSON();
    if (p === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (p === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    if (p === '/api/auth/register') { assert.ok(!('role' in body())); return route.fulfill({ json: { accessToken: 'test-session', user: { fullName: body().fullName, role: 'customer' } } }); }
    if (p === '/api/auth/login') return route.fulfill({ json: { accessToken: 'test-session', user: { fullName: 'Đối tác kiểm thử', role: accountRole } } });
    if (p === '/api/restaurants/mine') return route.fulfill({ json: [{ id: 'shop', name: application.shop.name, address: application.shop.address, active: true, menuItems: [] }] });
    if (p === '/api/merchant-applications/terms') return route.fulfill({ json: terms });
    if (p === '/api/merchant-applications/me') {
      if (method === 'PUT') application = { ...(application || { id: 'app', status: 'DRAFT', documents: [], bank: null, user: { fullName: 'Đối tác kiểm thử', email: 'test@example.invalid' } }), shop: body().shop };
      return route.fulfill({ json: application });
    }
    if (p.startsWith('/api/merchant-applications/me/documents/')) {
      assert.match(route.request().headers()['content-type'], /^multipart\/form-data; boundary=/);
      const kind = p.split('/').at(-1);
      application.documents = [...application.documents.filter((doc) => doc.kind !== kind), { id: kind, kind, mimeType: 'application/pdf', size: 50 }];
      return route.fulfill({ json: application });
    }
    if (p === '/api/merchant-applications/me/bank') { application.bank = body(); return route.fulfill({ json: application }); }
    if (p === '/api/merchant-applications/me/submit') {
      assert.deepEqual(body().agreements, { accuracy: true, terms: true, documentReview: true });
      assert.equal(body().termsVersion, terms.version); submissionCount++;
      application = { ...application, ...body(), status: 'SUBMITTED', acceptedAt: new Date().toISOString() }; return route.fulfill({ json: application });
    }
    if (p === '/api/admin/merchant-applications') return route.fulfill({ json: { data: application ? [application] : [], total: application ? 1 : 0 } });
    if (p === '/api/admin/merchant-applications/app') return route.fulfill({ json: application });
    if (p === '/api/admin/merchant-applications/app/reject') { assert.ok(body().reason.length >= 5); application.status = 'REJECTED'; application.rejectionReason = body().reason; return route.fulfill({ json: application }); }
    if (p === '/api/admin/merchant-applications/app/approve') { application.status = 'APPROVED'; accountRole = 'merchant'; return route.fulfill({ json: application }); }
    return route.abort();
  });
  return page;
}
async function tickAndSend(page) {
  await page.getByRole('checkbox').first().waitFor();
  assert.equal(await page.getByRole('checkbox').count(), 3);
  const submit = page.getByRole('button', { name: 'Gửi hồ sơ cho Admin duyệt' });
  assert.equal(await submit.isEnabled(), false);
  for (const checkbox of await page.getByRole('checkbox').all()) { assert.equal(await checkbox.isChecked(), false); await checkbox.check(); }
  await submit.click(); await page.getByRole('heading', { name: 'Hồ sơ đang chờ Admin duyệt' }).waitFor();
}
try {
  const page = await openPage(null);
  await page.goto('http://127.0.0.1:4173/login');
  await page.getByRole('link', { name: 'Đăng ký đối tác Merchant', exact: true }).click();
  await page.getByLabel('Họ tên người đại diện', { exact: true }).fill('Đối tác kiểm thử');
  await page.getByLabel('Email', { exact: true }).fill('partner@example.invalid');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0900000000');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TestOnly123');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('TestOnly123');
  await page.getByRole('button', { name: 'Tạo tài khoản và điền thông tin quán' }).click();
  await page.getByLabel('Tên quán', { exact: true }).fill('Quán mới kiểm thử');
  await page.getByLabel('Địa chỉ quán', { exact: true }).fill('Địa chỉ kiểm thử TP.HCM');
  await page.getByLabel('Vĩ độ quán', { exact: true }).fill('10.8');
  await page.getByLabel('Kinh độ quán', { exact: true }).fill('106.7');
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click();
  for (const label of ['CCCD mặt trước', 'CCCD mặt sau', 'Giấy phép kinh doanh', 'Giấy tờ VSATTP']) {
    await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest only') });
    await page.getByRole('button', { name: 'Tải ' + label, exact: true }).waitFor();
  }
  await page.getByLabel('Ngân hàng', { exact: true }).fill('Ngân hàng kiểm thử');
  await page.getByLabel('Số tài khoản', { exact: true }).fill('0000000000');
  await page.getByLabel('Chủ tài khoản', { exact: true }).fill('TEST ONLY');
  await page.getByRole('button', { name: 'Lưu hồ sơ và đọc điều khoản' }).click();
  for (const width of [1280, 375, 320]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await tickAndSend(page); assert.equal(submissionCount, 1);
  await page.reload(); await page.getByRole('heading', { name: 'Hồ sơ đang chờ Admin duyệt' }).waitFor();
  const admin = await openPage('admin');
  await admin.goto('http://127.0.0.1:4173/admin/merchant-applications');
  await admin.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click();
  await admin.getByRole('button', { name: 'Từ chối và yêu cầu bổ sung' }).click();
  await admin.getByRole('alert').filter({ hasText: 'Nhập lý do' }).waitFor();
  await admin.getByLabel('Lý do từ chối / yêu cầu bổ sung').fill('Vui lòng bổ sung giấy tờ rõ nét');
  await admin.getByRole('button', { name: 'Từ chối và yêu cầu bổ sung' }).click();
  await admin.getByText('Cần bổ sung hồ sơ', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kiểm tra trạng thái' }).click();
  await page.getByText(/Admin yêu cầu bổ sung:/).waitFor();
  await page.getByRole('button', { name: 'Lưu và tiếp tục' }).click();
  await page.getByRole('button', { name: 'Lưu hồ sơ và đọc điều khoản' }).click();
  await tickAndSend(page);
  await admin.reload(); await admin.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click();
  await admin.getByRole('checkbox').check(); admin.once('dialog', (dialog) => dialog.accept());
  await admin.getByRole('button', { name: 'Duyệt và cấp quyền Merchant' }).click();
  await admin.getByText('Đã duyệt', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kiểm tra trạng thái' }).click();
  await page.getByRole('heading', { name: 'Hồ sơ đã được phê duyệt' }).waitFor();
  await page.getByRole('button', { name: 'Đăng nhập lại', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('partner@example.invalid');
  await page.getByPlaceholder('Nhập mật khẩu').fill('TestOnly123');
  await page.locator('.auth-form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/merchant/dashboard');
  assert.deepEqual(errors, []);
  console.log('PASS: login entry, partner signup, shop, four private uploads, bank, unchecked consents, mobile, submit/reload, admin rejection/resubmit/approval, correct merchant login (mock APIs).');
} finally { await browser.close(); }
