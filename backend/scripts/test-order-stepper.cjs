// Hai trình duyệt + API/socket/DB thật; chỉ tạo đơn tiền mặt fixture và tự dọn.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { ConfigModule } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { DataSource, In } = require('typeorm');
const { entities, User, Restaurant, MenuItem, Order } = require('../dist/database/entities');
const { OrdersModule } = require('../dist/orders/orders.module');
const { OrdersGateway } = require('../dist/orders/gateway/orders.gateway');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const { FavoritesModule } = require('../dist/favorites/favorites.module');
const { chromium } = require('../../web/node_modules/playwright');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), OrdersModule, RestaurantsModule, FavoritesModule] })(TestModule);
async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.enableCors(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = [randomUUID(), randomUUID()], restaurantId = randomUUID(), menuId = randomUUID();
  let browser;
  try {
    await app.listen(0, '127.0.0.1');
    const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (let i = 0; i < 2; i++) await ds.getRepository(User).save({ id: users[i], email: `${users[i]}@example.invalid`, passwordHash: 'fixture-no-login', phone: '0900000000', fullName: 'Stepper fixture', role: i ? 'merchant' : 'customer' });
    await ds.getRepository(Restaurant).save({ id: restaurantId, name: 'Quán stepper fixture', address: 'Địa chỉ thử nghiệm', ownerId: users[1], active: true, location: { type: 'Point', coordinates: [106.7, 10.78] } });
    await ds.getRepository(MenuItem).save({ id: menuId, restaurantId, name: 'Cơm kiểm thử', price: 10000, available: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    const makePage = async (index, offlineSocket = false) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript(({ apiBase, token, user }) => {
        let config;
        Object.defineProperty(window, 'ROUTEBITE_CONFIG', { configurable: true, get: () => config, set: (value) => { config = { ...value, apiBase }; } });
        localStorage.setItem('routebite_access_token', token); localStorage.setItem('routebite_user', JSON.stringify(user));
      }, { apiBase: base + '/api', token: jwt.sign({ sub: users[index], role: index ? 'merchant' : 'customer' }, { secret, expiresIn: '10m' }), user: { id: users[index], role: index ? 'merchant' : 'customer', fullName: 'Stepper fixture' } });
      const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => { const url = new URL(route.request().url()); if (offlineSocket && url.pathname.startsWith('/socket.io')) return route.abort(); return url.port === '4173' || url.origin === base ? route.continue() : route.abort(); });
      return page;
    };
    const customer = await makePage(0), merchant = await makePage(1);
    const place = async (page) => {
      await page.goto('http://127.0.0.1:4173/restaurant/' + restaurantId);
      await page.getByRole('button', { name: 'Thêm Cơm kiểm thử', exact: true }).click(); await page.getByRole('link', { name: /Xem giỏ hàng/ }).click();
      const pending = page.waitForResponse((r) => r.url() === base + '/api/orders' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click(); const order = await (await pending).json();
      await page.locator('.rb-order-stepper [aria-current="step"]').filter({ hasText: 'Chờ xác nhận' }).waitFor();
      assert.equal(await page.locator('.rb-empty').count(), 0); return order;
    };
    const placed = await place(customer);
    await customer.getByText('Đang cập nhật trực tiếp', { exact: true }).waitFor();
    for (const width of [320, 375, 1280]) {
      await customer.setViewportSize({ width, height: 850 });
      assert.ok(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await customer.locator('.rb-order-stepper li').count(), 5);
    }
    // Một sự kiện khác đơn không được thay đổi thanh tiến độ đang theo dõi.
    app.get(OrdersGateway).server.emit('order.status.updated', { orderId: randomUUID(), status: 'CANCELLED', updatedAt: new Date().toISOString() });
    await customer.waitForTimeout(100); assert.match(await customer.locator('[aria-current="step"]').textContent(), /Chờ xác nhận/);
    await merchant.goto('http://127.0.0.1:4173/merchant/orders');
    const card = merchant.locator('.rb-kanban-card').filter({ has: merchant.getByRole('link', { name: placed.orderCode, exact: true }) });
    const customerUrl = customer.url();
    for (const [button, label] of [['Xác nhận →', 'Đã xác nhận'], ['Bắt đầu chuẩn bị →', 'Đang chuẩn bị'], ['Sẵn sàng →', 'Sẵn sàng'], ['Khách đã lấy ✓', 'Hoàn thành']]) {
      await card.getByRole('button', { name: button, exact: true }).click();
      await customer.locator('.rb-order-stepper [aria-current="step"]').filter({ hasText: label }).waitFor({ timeout: 5000 });
      assert.equal(customer.url(), customerUrl);
      assert.equal(await customer.locator('.rb-placed-order-eta').count(), label === 'Hoàn thành' ? 0 : 1);
    }
    await customer.getByText('Đã thanh toán tiền mặt.', { exact: false }).waitFor();
    await customer.getByRole('link', { name: 'Xem chi tiết đơn', exact: true }).click();
    await customer.locator('.rb-order-stepper [aria-current="step"]').filter({ hasText: 'Hoàn thành' }).waitFor();
    // Mất socket vẫn cập nhật qua polling, bao gồm trạng thái hủy.
    const fallback = await makePage(0, true); await fallback.clock.install();
    const pendingOrder = await place(fallback);
    await merchant.reload();
    const pendingCard = merchant.locator('.rb-kanban-card').filter({ has: merchant.getByRole('link', { name: pendingOrder.orderCode, exact: true }) });
    merchant.once('dialog', (dialog) => dialog.accept()); await pendingCard.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    await merchant.getByRole('button', { name: 'Đã hủy (1)', exact: true }).waitFor();
    await fallback.clock.fastForward(16000); await fallback.getByText('Đơn hàng đã bị hủy', { exact: true }).waitFor();
    assert.equal(await fallback.locator('.rb-order-stepper').count(), 0); assert.equal(await fallback.locator('.rb-placed-order-eta').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: real DB cash checkout + five-step confirmation; second merchant browser advances all states live without navigation; foreign events ignored; mobile 320/375/1280; detail reuse; socket-off polling + cancelled branch; fixture-only cleanup.');
  } finally {
    await browser?.close(); const ds = app.get(DataSource);
    if (ds.isInitialized) { await ds.getRepository(Order).delete({ restaurantId }); await ds.getRepository(Restaurant).delete({ id: restaurantId }); await ds.getRepository(User).delete({ id: In(users) }); }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
