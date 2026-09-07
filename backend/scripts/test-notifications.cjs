// Server kiểm thử riêng, không thay cấu hình hoặc dừng backend đang phục vụ người dùng.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ConfigModule } = require('@nestjs/config');
const { JwtModule, JwtService } = require('@nestjs/jwt');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { DataSource, In } = require('typeorm');
const { io } = require('socket.io-client');
const { Notification } = require('../dist/notifications/entities/notification.entity');
const { NotificationsController } = require('../dist/notifications/notifications.controller');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { NotificationsGateway } = require('../dist/notifications/notifications.gateway');
const { JwtAuthGuard } = require('../dist/auth/guards/jwt-auth.guard');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex');
process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), JwtModule.register({}),
  TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities: [Notification], synchronize: false }),
  TypeOrmModule.forFeature([Notification])], controllers: [NotificationsController], providers: [NotificationsService, NotificationsGateway, JwtAuthGuard] })(TestModule);
const userA = randomUUID(); const userB = randomUUID(); const orderId = randomUUID();
const sockets = [];
const waitEvent = (socket, event) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, receive); reject(new Error('Timed out: ' + event)); }, 10000);
  const receive = (payload) => { clearTimeout(timer); resolve(payload); };
  socket.once(event, receive);
});
async function main() {
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api'); app.enableCors();
  let browser;
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const jwt = app.get(JwtService);
    const token = (sub) => jwt.sign({ sub, role: 'customer', email: 'notification-test@example.invalid' }, { secret, expiresIn: '5m' });
    const tokenA = token(userA); const tokenB = token(userB);
    const service = app.get(NotificationsService);
    const repo = app.get(DataSource).getRepository(Notification);
    const call = (url, bearer, method = 'GET') => fetch(base + '/api/notifications' + url, { method, headers: bearer ? { Authorization: 'Bearer ' + bearer } : {} });
    assert.equal((await call('', null)).status, 401);
    const socketA = io(base + '/notifications', { autoConnect: false, auth: { token: tokenA } });
    const socketB = io(base + '/notifications', { autoConnect: false, auth: { token: tokenB } });
    sockets.push(socketA, socketB);
    await Promise.all(sockets.map((socket) => { const ready = waitEvent(socket, 'connect'); socket.connect(); return ready; }));
    const gateway = app.get(NotificationsGateway);
    socketB.emit('join', { userId: userA });
    const outsider = gateway.server.sockets.get(socketB.id);
    assert.ok(!outsider.rooms.has('user:' + userA));
    const event = waitEvent(socketA, 'notification.new');
    const note = await service.createAndNotify(userA, 'Cập nhật đơn hàng', 'Đơn hàng của bạn đã được xác nhận', { type: 'order_status', orderId });
    assert.equal((await event).id, note.id);
    assert.equal((await (await call('', tokenB)).json()).notifications.length, 0);
    assert.equal((await call('/' + note.id + '/read', tokenB, 'PATCH')).status, 404);
    assert.equal((await call('/invalid/read', tokenA, 'PATCH')).status, 400);
    assert.equal((await call('/' + note.id + '/read', tokenA, 'PATCH')).status, 200);
    assert.equal((await call('/' + note.id + '/read', tokenA, 'PATCH')).status, 200);
    await repo.save(Array.from({ length: 55 }, (_, i) => repo.create({ userId: userA, title: 'Test ' + i, body: 'Dữ liệu kiểm thử', isRead: false })));
    const list = await (await call('', tokenA)).json();
    assert.equal(list.notifications.length, 50); assert.equal(list.unreadCount, 55);
    await call('/read-all', tokenA, 'PATCH');
    assert.equal((await (await call('', tokenA)).json()).unreadCount, 0);
    const invalid = io(base + '/notifications', { autoConnect: false, auth: { token: 'invalid' } }); sockets.push(invalid);
    const denied = waitEvent(invalid, 'connect_error'); invalid.connect();
    assert.equal((await denied).message, 'UNAUTHORIZED');
    sockets.forEach((socket) => socket.disconnect());
    console.log('PASS: JWT HTTP/socket, rooms cannot be spoofed, recipient isolation, real DB persistence, 50-row limit, total unread count, idempotent reads.');

    if (process.argv.includes('--browser')) {
      const { chromium } = require('../../web/node_modules/playwright');
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(({ apiBase, token, userId }) => {
        Object.defineProperty(window, 'ROUTEBITE_CONFIG', { value: { apiBase }, writable: false });
        localStorage.setItem('routebite_access_token', token);
        localStorage.setItem('routebite_user', JSON.stringify({ id: userId, role: 'customer', fullName: 'Khách kiểm thử' }));
      }, { apiBase: base + '/api', token: tokenA, userId: userA });
      await page.route('**/api/orders/*', (route) => route.fulfill({ json: { id: orderId, status: 'CONFIRMED', restaurant: { name: 'Quán kiểm thử' }, items: [], paymentMethod: 'cash' } }));
      await page.route('**/api/restaurants*', (route) => route.fulfill({ json: { data: [], total: 0 } }));
      const browserConnected = waitEvent(gateway.server, 'connection');
      await page.goto('http://127.0.0.1:4173/');
      await page.getByRole('button', { name: 'Thông báo', exact: true }).waitFor();
      await browserConnected;
      const latest = await service.createAndNotify(userA, 'Cập nhật đơn hàng', 'Món của bạn đã sẵn sàng, mời ghé lấy!', { orderId, type: 'order_status' });
      await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc', exact: true }).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc', exact: true }).click();
      await page.getByRole('button').filter({ hasText: 'Món của bạn đã sẵn sàng, mời ghé lấy!' }).click();
      await page.waitForURL('**/orders/' + orderId);
      assert.equal((await repo.findOneByOrFail({ id: latest.id })).isRead, true);
      await page.getByRole('button', { name: 'Thông báo', exact: true }).waitFor();
      await page.setViewportSize({ width: 375, height: 850 });
      await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Danh sách thông báo' });
      const bounds = await panel.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375);
      await page.keyboard.press('Escape'); assert.equal(await panel.count(), 0);
      assert.deepEqual(errors, []);
      console.log('PASS: realtime bell badge without refresh, click → order detail + read persisted, mobile dropdown, Escape.');
    }
  } finally {
    if (browser) await browser.close();
    sockets.forEach((socket) => socket.disconnect());
    // Chỉ xóa bản ghi do lần test này tạo, không đụng thông báo thật của người dùng.
    if (app.get(DataSource).isInitialized) await app.get(DataSource).getRepository(Notification).delete({ userId: In([userA, userB]) });
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
