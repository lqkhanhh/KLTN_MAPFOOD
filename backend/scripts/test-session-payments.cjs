// Real local database, isolated server/secrets, synthetic callback; no bank/AI calls.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { DataSource, In } = require('typeorm');
require('dotenv').config();
Object.assign(process.env, { JWT_ACCESS_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), DB_SYNCHRONIZE: 'false', DB_MIGRATIONS_RUN: 'false', PAYMENT_PROVIDER: 'VNPAY', VNPAY_TMN_CODE: 'TEST1234', VNPAY_HASH_SECRET: randomBytes(32).toString('hex'), VNPAY_URL: 'https://example.invalid/checkout', VNPAY_RETURN_URL: 'http://127.0.0.1/test-return', ANTHROPIC_API_KEY: '', GOOGLE_MAPS_API_KEY: '' });
const { AppModule } = require('../dist/app.module');
const { User, Restaurant, Order } = require('../dist/database/entities');
const { Notification } = require('../dist/notifications/entities/notification.entity');
async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = [], shops = [], orders = [];
  try {
    await app.listen(0, '127.0.0.1');
    const ds = app.get(DataSource), base = (await app.getUrl()) + '/api';
    const call = async (path, token, method, body, expected) => {
      const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json(); assert.equal(r.status, expected, path + ': ' + JSON.stringify(data)); return data;
    };
    const account = async (role) => {
      const email = `retest-${randomUUID()}@example.invalid`, password = randomBytes(16).toString('hex');
      const reg = await call('/auth/register', null, 'POST', { email, password, fullName: 'Retest fixture', phone: '0900000000' }, 201);
      users.push(reg.user.id); assert.equal(reg.user.role, 'customer');
      if (role !== 'customer') await ds.getRepository(User).update(reg.user.id, { role });
      return { ...(await call('/auth/login', null, 'POST', { email, password }, 201)), email, password };
    };
    const customer = await account('customer'), stranger = await account('customer'), merchant = await account('merchant');
    await account('admin');
    await call('/auth/login', null, 'POST', { email: customer.email, password: 'wrong' }, 401);
    await call('/auth/refresh', null, 'POST', { refreshToken: customer.refreshToken }, 201);
    await call('/auth/change-password', customer.accessToken, 'PATCH', { oldPassword: customer.password, newPassword: 'Retest-new-password-123' }, 200);
    await call('/auth/login', null, 'POST', { email: customer.email, password: customer.password }, 401);
    await call('/auth/refresh', null, 'POST', { refreshToken: customer.refreshToken }, 401);
    await call('/auth/login', null, 'POST', { email: customer.email, password: 'Retest-new-password-123' }, 201);
    console.log('PASS: real registration/login/refresh/change-password and refresh invalidation');
    if (!process.argv.includes('--skip-payments')) {
    const shop = await call('/restaurants', merchant.accessToken, 'POST', { name: 'Retest shop', address: 'Fixture only', latitude: 10.8, longitude: 106.7, openingHours: '08:00-22:00', menuItems: [{ name: 'Fixture food', price: 12000 }] }, 201); shops.push(shop.id);
    const body = { restaurantId: shop.id, pickupOption: { type: 'asap', estimatedPickupMinutes: 15 }, payment: { method: 'vnpay' }, items: [{ menuItemId: shop.menuItems[0].id, quantity: 2 }] };
    const order = await call('/orders', customer.accessToken, 'POST', body, 201); orders.push(order.id); assert.equal(order.totalAmount, 24000);
    await call('/payments/create', stranger.accessToken, 'POST', { orderId: order.id }, 403);
    const payment = await call('/payments/create', customer.accessToken, 'POST', { orderId: order.id }, 201);
    assert.equal((await call('/payments/create', customer.accessToken, 'POST', { orderId: order.id }, 201)).transactionId, payment.transactionId);
    const query = new URL(payment.checkoutUrl).searchParams;
    const payload = { vnp_TmnCode: 'TEST1234', vnp_TxnRef: payment.transactionId, vnp_Amount: '2400000', vnp_OrderInfo: query.get('vnp_OrderInfo'), vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '12345' };
    const sign = (value) => ({ ...value, vnp_SecureHash: createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(Object.keys(value).sort().map(k => k + '=' + encodeURIComponent(value[k]).replace(/%20/g, '+')).join('&')).digest('hex') });
    await call('/payments/vnpay-ipn', null, 'POST', { ...payload, vnp_SecureHash: 'invalid' }, 400);
    await call('/payments/vnpay-ipn', null, 'POST', sign({ ...payload, vnp_Amount: '100000' }), 400);
    await call('/payments/vnpay-ipn', null, 'POST', sign(payload), 200);
    await call('/payments/vnpay-ipn', null, 'POST', sign(payload), 200);
    await call('/payments/vnpay-return?' + new URLSearchParams(sign(payload)), null, 'GET', null, 200);
    assert.equal((await call('/orders/' + order.id, customer.accessToken, 'GET', null, 200)).paymentStatus, 'PAID');
    await call('/payments/create', customer.accessToken, 'POST', { orderId: order.id }, 409);
    console.log('PASS: real payment create/reuse/ownership, signature+amount rejection, duplicate IPN/return, PAID and re-payment blocked; synthetic provider only');
    } else { console.log('SKIP: all payment creation/provider/callback tests'); }
    const child = spawnSync(process.execPath, ['scripts/test-merchant-applications.cjs'], { encoding: 'utf8', timeout: 60000 });
    process.stdout.write(child.stdout || ''); process.stderr.write(child.stderr || ''); assert.equal(child.status, 0, 'partner application suite with temporary admin');
  } finally {
    const ds = app.get(DataSource);
    await ds.transaction(async manager => {
      if (orders.length) await manager.delete(Order, { id: In(orders) });
      if (shops.length) await manager.delete(Restaurant, { id: In(shops) });
      if (users.length) { await manager.delete(Notification, { userId: In(users) }); await manager.delete(User, { id: In(users) }); }
    });
    await app.close(); console.log('CLEANUP: session/payment fixtures removed');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
