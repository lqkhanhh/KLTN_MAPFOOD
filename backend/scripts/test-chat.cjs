// API + socket + hai phiên trình duyệt với DB thật. Chỉ xóa fixture UUID của lần chạy này.
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
const { io } = require('socket.io-client');
const { entities, User, Restaurant, Order } = require('../dist/database/entities');
const { Message } = require('../dist/messages/message.entity');
const { MessagesModule } = require('../dist/messages/messages.module');
const { OrdersModule } = require('../dist/orders/orders.module');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const { FavoritesModule } = require('../dist/favorites/favorites.module');
const { chromium } = require('../../web/node_modules/playwright');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), MessagesModule, OrdersModule, RestaurantsModule, FavoritesModule] })(TestModule);
async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.enableCors(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = Array.from({ length: 5 }, () => randomUUID()), restaurantId = randomUUID(), orders = [randomUUID(), randomUUID()];
  const roles = ['customer', 'merchant', 'customer', 'merchant', 'admin'];
  const sockets = []; let browser;
  try {
    await app.listen(0, '127.0.0.1');
    const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (let i = 0; i < users.length; i++) await ds.getRepository(User).save({ id: users[i], email: `${users[i]}@example.invalid`, passwordHash: 'fixture-not-login', fullName: `Chat fixture ${roles[i]}`, role: roles[i] });
    await ds.getRepository(Restaurant).save({ id: restaurantId, name: 'Quán chat fixture', address: 'Địa chỉ tạm', ownerId: users[1], active: true, location: { type: 'Point', coordinates: [106.7, 10.78] } });
    for (let i = 0; i < orders.length; i++) await ds.getRepository(Order).save({ id: orders[i], orderCode: 'CHAT-' + orders[i].slice(0, 20), userId: users[i === 0 ? 0 : 2], restaurantId,
      status: 'PENDING', pickupType: 'asap', estimatedPickupMinutes: 15, estimatedPickupAt: new Date(Date.now() + 900000), paymentMethod: 'cash', subtotal: 10000, totalAmount: 10000, customerName: 'Khách fixture', customerPhone: '0900000000' });
    const token = (index, expiry = '10m') => jwt.sign({ sub: users[index], role: roles[index] }, { secret, expiresIn: expiry });
    const call = async (index, method = 'GET', body, orderId = orders[0]) => {
      const res = await fetch(`${base}/api/orders/${orderId}/messages`, { method, headers: { 'Content-Type': 'application/json', ...(index !== null ? { Authorization: 'Bearer ' + token(index) } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, data: await res.json() };
    };
    assert.equal((await call(null)).status, 401);
    for (const index of [2, 3, 4]) for (const method of ['GET', 'POST']) assert.equal((await call(index, method, method === 'POST' ? { content: 'forbidden' } : undefined)).status, 403);
    for (const body of [{ content: '  ' }, { content: 'a'.repeat(2001) }, { content: 12 }, { content: 'x', senderId: users[1], senderRole: 'merchant' }]) assert.equal((await call(0, 'POST', body)).status, 400);
    assert.equal((await call(0, 'GET', undefined, 'invalid')).status, 400);
    const connect = async (index) => {
      const client = io(base + '/chat', { auth: { token: token(index) }, transports: ['websocket'], autoConnect: false }); sockets.push(client);
      await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
      return client;
    };
    const joinRoom = (client, orderId) => new Promise((resolve, reject) => client.timeout(3000).emit('join', { orderId }, (err, data) => err ? reject(err) : resolve(data)));
    const intruder = await connect(2); assert.equal((await joinRoom(intruder, orders[0])).ok, false);
    for (const badToken of ['invalid-token', token(0, '-1s')]) {
      const rejected = io(base + '/chat', { auth: { token: badToken }, transports: ['websocket'], autoConnect: false }); sockets.push(rejected);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Invalid chat JWT was not disconnected')), 3000);
        rejected.once('disconnect', () => { clearTimeout(timer); resolve(); }); rejected.connect();
      });
    }
    assert.equal((await joinRoom(intruder, orders[1])).ok, true);
    let leaked = 0; intruder.on('message.new', () => leaked++);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const pageErrors = [];
    const makePage = async (index) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript(({ apiBase, accessToken, user }) => {
        let config;
        Object.defineProperty(window, 'ROUTEBITE_CONFIG', { configurable: true, get: () => config, set: (value) => { config = { ...value, apiBase }; } });
        localStorage.setItem('routebite_access_token', accessToken); localStorage.setItem('routebite_user', JSON.stringify(user));
      }, { apiBase: base + '/api', accessToken: token(index), user: { id: users[index], role: roles[index], fullName: 'Chat fixture' } });
      const page = await context.newPage(); page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.route('**/*', (route) => { const url = new URL(route.request().url()); return url.port === '4173' || url.origin === base ? route.continue() : route.abort(); });
      return page;
    };
    const customer = await makePage(0), merchant = await makePage(1);
    await customer.goto('http://127.0.0.1:4173/orders/' + orders[0]);
    await merchant.goto('http://127.0.0.1:4173/merchant/orders');
    await customer.getByRole('button', { name: 'Nhắn tin với quán', exact: true }).click();
    const merchantCard = merchant.locator('.rb-kanban-card').filter({ has: merchant.getByRole('link', { name: 'CHAT-' + orders[0].slice(0, 20), exact: true }) });
    await merchantCard.getByRole('button', { name: 'Nhắn tin với khách', exact: true }).click();
    for (const page of [customer, merchant]) await page.getByText('Đã kết nối realtime', { exact: true }).waitFor();
    await customer.getByPlaceholder('Nhập tin nhắn...').fill('Cho mình ít đá <script>không chạy</script>');
    await customer.getByRole('button', { name: 'Gửi', exact: true }).click();
    await merchant.locator('.rb-chat-message').filter({ hasText: 'Cho mình ít đá' }).waitFor({ timeout: 5000 });
    await merchant.getByPlaceholder('Nhập tin nhắn...').fill('Quán đã nhận lời nhắn nhé'); await merchant.getByRole('button', { name: 'Gửi', exact: true }).click();
    await customer.locator('.rb-chat-message').filter({ hasText: 'Quán đã nhận' }).waitFor({ timeout: 5000 });
    for (const page of [customer, merchant]) { assert.equal(await page.locator('.rb-chat-message').count(), 2); assert.equal(await page.locator('.rb-chat-message.mine').count(), 1); assert.equal(await page.locator('.rb-chat-message script').count(), 0); }
    assert.equal(leaked, 0);
    const saved = (await call(0)).data; assert.equal(saved.length, 2); assert.equal(saved[0].senderRole, 'customer'); assert.equal(saved[1].senderRole, 'merchant');
    assert.equal(await ds.getRepository(Message).countBy({ orderId: orders[0] }), 2);
    await customer.reload(); await customer.getByRole('button', { name: 'Nhắn tin với quán', exact: true }).click();
    await customer.locator('.rb-chat-message').filter({ hasText: 'Quán đã nhận' }).waitFor(); assert.equal(await customer.locator('.rb-chat-message').count(), 2);
    await customer.setViewportSize({ width: 320, height: 650 }); const bounds = await customer.getByRole('dialog').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    await merchant.getByRole('button', { name: 'Đóng trò chuyện' }).click(); assert.equal(await merchant.locator('.rb-chat-drawer').count(), 0);
    // Thu hồi quyền sở hữu quán: socket đã vào room trước đó cũng không được nhận tin mới.
    const oldOwner = await connect(1); assert.equal((await joinRoom(oldOwner, orders[0])).ok, true);
    let revokedLeak = 0; oldOwner.on('message.new', () => revokedLeak++);
    await ds.getRepository(Restaurant).update(restaurantId, { ownerId: users[3] });
    assert.equal((await call(0, 'POST', { content: 'Sau khi đổi chủ' })).status, 201);
    assert.equal((await call(1)).status, 403); assert.equal((await call(3)).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 150)); assert.equal(revokedLeak, 0);
    assert.deepEqual(pageErrors, []);
    console.log('PASS: real DB REST + two-browser realtime chat; persistence, sender alignment, dedup, safe text, mobile; JWT/ownership/admin denied, room isolation, revoked owner cannot receive.');
  } finally {
    await browser?.close(); sockets.forEach((socket) => socket.disconnect());
    const ds = app.get(DataSource);
    if (ds.isInitialized) { await ds.getRepository(Order).delete({ id: In(orders) }); await ds.getRepository(Restaurant).delete({ id: restaurantId }); await ds.getRepository(User).delete({ id: In(users) }); }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
