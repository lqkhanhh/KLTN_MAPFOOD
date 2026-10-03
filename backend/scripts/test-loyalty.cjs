// API thật + PostgreSQL thật, provider thanh toán giả; chỉ tạo/xóa fixture UUID riêng.
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
const { entities, User, Restaurant, MenuItem, Order, Payment } = require('../dist/database/entities');
const { Voucher, UserVoucher, PointsTransaction } = require('../dist/loyalty/loyalty.entity');
const { LoyaltyModule } = require('../dist/loyalty/loyalty.module');
const { OrdersService } = require('../dist/orders/orders.service');
const { OrdersController } = require('../dist/orders/orders.controller');
const { OrdersGateway } = require('../dist/orders/gateway/orders.gateway');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { PaymentsService } = require('../dist/payments/payments.service');
const { PAYMENT_PROVIDER_ADAPTER } = require('../dist/payments/providers/payment-provider.interface');
const { AuthModule } = require('../dist/auth/auth.module');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret;
let providerAmount;
const provider = { provider: 'VNPAY', createPayment: async (data) => { providerAmount = data.amount; return { checkoutUrl: 'https://example.invalid/checkout', safePayload: {} }; } };
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), AuthModule, LoyaltyModule],
  controllers: [OrdersController], providers: [OrdersService, PaymentsService, { provide: PAYMENT_PROVIDER_ADAPTER, useValue: provider },
    { provide: OrdersGateway, useValue: { emitCreated() {}, emitStatusUpdated() {}, emitPaymentUpdated() {} } },
    { provide: NotificationsService, useValue: { create: async () => undefined, publish() {} } }] })(TestModule);

async function main() {
  console.log('Loyalty test: starting isolated Nest server');
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = Array.from({ length: 4 }, randomUUID), restaurantId = randomUUID(), menuId = randomUUID(), voucherIds = [];
  const roles = ['customer', 'customer', 'merchant', 'admin'];
  try {
    await app.listen(0, '127.0.0.1');
    console.log('Loyalty test: server ready, preparing fixtures');
    const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (let i = 0; i < users.length; i++) await ds.getRepository(User).save({ id: users[i], email: `${users[i]}@example.invalid`, passwordHash: 'fixture-no-login', fullName: 'Kiểm thử xu', phone: '0900000000', role: roles[i] });
    await ds.getRepository(Restaurant).save({ id: restaurantId, name: 'Quán fixture xu', address: 'Fixture tạm', ownerId: users[2], active: true, location: { type: 'Point', coordinates: [106.7, 10.78] } });
    await ds.getRepository(MenuItem).save({ id: menuId, restaurantId, name: 'Món fixture xu', price: 100000, available: true });
    const call = async (path, index = 0, method = 'GET', body) => {
      const response = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(index !== null ? { Authorization: 'Bearer ' + jwt.sign({ sub: users[index], role: roles[index] }, { secret, expiresIn: '5m' }) } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const create = (userVoucherId, method = 'cash', index = 0, quantity = 1) => call('/orders', index, 'POST', { restaurantId, ...(userVoucherId ? { userVoucherId } : {}),
      items: [{ menuItemId: menuId, quantity }], pickupOption: { type: 'asap', estimatedPickupMinutes: 15 }, payment: { method } });
    const status = (orderId, next) => call(`/orders/${orderId}/status`, 2, 'PATCH', { status: next });
    const ready = async (id) => { for (const state of ['CONFIRMED', 'PREPARING', 'READY']) assert.equal((await status(id, state)).status, 200); };
    const balance = async () => (await call('/points/me')).data.pointsBalance;
    async function voucher(data) {
      const result = await call('/admin/vouchers', 3, 'POST', { code: 'TEST_' + randomUUID().slice(0, 8), title: 'Ưu đãi fixture', discountType: 'fixed', discountValue: 1000, minOrderAmount: 10000, ...data });
      assert.equal(result.status, 201, JSON.stringify(result.data)); voucherIds.push(result.data.id); return result.data;
    }
    assert.equal((await call('/points/me', null)).status, 401);
    assert.equal((await call('/points/me', 2)).status, 403);
    assert.equal((await call('/admin/vouchers', 0)).status, 403);
    assert.equal(await balance(), 0);
    const first = await create(); assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(await balance(), 0); await ready(first.data.id);
    const completes = await Promise.all([status(first.data.id, 'COMPLETED'), status(first.data.id, 'COMPLETED')]);
    assert.ok(completes.every((r) => r.status === 200)); assert.equal(await balance(), 1);
    assert.equal(await ds.getRepository(PointsTransaction).countBy({ orderId: first.data.id, type: 'earn' }), 1);
    // Một xu thật vừa kiếm được: hai lần đổi đồng thời chỉ một lần thành công.
    const reward = await voucher({}); await ds.getRepository(Voucher).update(reward.id, { pointsCost: 1 });
    const redeems = await Promise.all([call(`/vouchers/${reward.id}/redeem`, 0, 'POST'), call(`/vouchers/${reward.id}/redeem`, 0, 'POST')]);
    assert.deepEqual(redeems.map((r) => r.status).sort(), [201, 400]); assert.equal(await balance(), 0);
    const ownedId = redeems.find((r) => r.status === 201).data.userVoucher.id;
    assert.equal((await create(ownedId, 'cash', 1)).status, 409);
    const skipPayments = process.argv.includes('--skip-payments');
    const orders = await Promise.all([create(ownedId, skipPayments ? 'cash' : 'vnpay'), create(ownedId, skipPayments ? 'cash' : 'vnpay')]);
    assert.deepEqual(orders.map((r) => r.status).sort(), [201, 409]);
    const discounted = orders.find((r) => r.status === 201).data;
    assert.equal(discounted.subtotal, 100000); assert.equal(discounted.discountAmount, 1000); assert.equal(discounted.totalAmount, 99000);
    assert.equal(discounted.appliedVoucherId, reward.id);
    if (!skipPayments) {
    await app.get(PaymentsService).create(discounted.id, { sub: users[0], role: 'customer' });
    assert.equal(providerAmount, 99000); assert.equal((await ds.getRepository(Payment).findOneBy({ orderId: discounted.id })).amount, 99000);
    await ready(discounted.id); assert.equal((await status(discounted.id, 'COMPLETED')).status, 409); // Chưa trả tiền.
    await ds.getRepository(Order).update(discounted.id, { paymentStatus: 'PAID' });
    } else { await ready(discounted.id); }
    assert.equal((await status(discounted.id, 'COMPLETED')).status, 200); assert.equal(await balance(), 0); // 99k chưa đủ một xu.
    const five = await create(undefined, 'cash', 0, 5); await ready(five.data.id); await status(five.data.id, 'COMPLETED'); assert.equal(await balance(), 5);
    const cancelled = await create(); await status(cancelled.data.id, 'CANCELLED'); assert.equal(await balance(), 5);
    // Miễn phí nhận một lần, không trừ xu; mức tối thiểu và trạng thái kiểm tra tại backend.
    const publicV = await voucher({ minOrderAmount: 200000 });
    const claims = await Promise.all([call(`/vouchers/${publicV.id}/claim`, 0, 'POST'), call(`/vouchers/${publicV.id}/claim`, 0, 'POST')]);
    assert.ok(claims.every((r) => r.status === 201)); assert.equal(claims[0].data.userVoucher.id, claims[1].data.userVoucher.id); assert.equal(await balance(), 5);
    const publicOwned = claims[0].data.userVoucher.id;
    assert.equal((await create(publicOwned)).status, 400);
    assert.equal((await ds.getRepository(UserVoucher).findOneBy({ id: publicOwned })).usedInOrderId, null);
    assert.equal((await call(`/admin/vouchers/${publicV.id}`, 3, 'PATCH', { active: false })).status, 200);
    assert.equal((await create(publicOwned, 'cash', 0, 2)).status, 409);
    assert.equal((await call(`/admin/vouchers/${publicV.id}`, 0, 'PATCH', { active: true })).status, 403);
    assert.equal((await call(`/vouchers/${publicV.id}/redeem`, 0, 'POST')).status, 404);
    assert.equal((await call('/admin/vouchers', 3, 'POST', { code: 'BAD', title: 'Sai', discountType: 'percent', discountValue: 101, minOrderAmount: 0 })).status, 400);
    const percent = await voucher({ discountType: 'percent', discountValue: 15, minOrderAmount: 0 });
    const percentOwned = (await call(`/vouchers/${percent.id}/claim`, 0, 'POST')).data.userVoucher.id;
    await ds.getRepository(MenuItem).update(menuId, { price: 100005 });
    const percentOrder = await create(percentOwned); assert.equal(percentOrder.data.discountAmount, 15001); assert.equal(percentOrder.data.totalAmount, 85004);
    await ds.getRepository(MenuItem).update(menuId, { price: 100000 });
    const free = await voucher({ discountValue: 200000, minOrderAmount: 0 });
    const freeOwned = (await call(`/vouchers/${free.id}/claim`, 0, 'POST')).data.userVoucher.id;
    const freeOrder = await create(freeOwned, skipPayments ? 'cash' : 'vnpay'); assert.equal(freeOrder.status, 201); assert.equal(freeOrder.data.totalAmount, 0); assert.equal(freeOrder.data.paymentStatus, 'PAID');
    await ready(freeOrder.data.id); assert.equal((await status(freeOrder.data.id, 'COMPLETED')).status, 200); assert.equal(await balance(), 5);
    assert.equal((await call('/orders', 0, 'POST', { restaurantId, userVoucherId: 'bad' })).status, 400);
    assert.ok(!(await call('/vouchers/my-vouchers', 1)).data.some((v) => v.id === ownedId));
    if (skipPayments) assert.equal(providerAmount, undefined);
    console.log('PASS: loyalty earn/redeem/use/ownership/concurrency/limits/ledger; ' + (skipPayments ? 'cash orders only, no payment provider calls.' : 'discounted payment provider amount verified.'));
  } finally {
    const ds = app.get(DataSource);
    if (ds.isInitialized) {
      await ds.getRepository(PointsTransaction).delete({ userId: In(users) });
      await ds.getRepository(UserVoucher).delete({ userId: In(users) });
      await ds.getRepository(Order).delete({ restaurantId });
      await ds.getRepository(Restaurant).delete({ id: restaurantId });
      await ds.getRepository(User).delete({ id: In(users) });
      if (voucherIds.length) await ds.getRepository(Voucher).delete({ id: In(voucherIds) });
    }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
