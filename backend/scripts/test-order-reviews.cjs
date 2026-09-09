// Kiểm thử API với PostgreSQL thật; fixture riêng được dọn sau khi chạy.
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
const { entities, User, Restaurant, MenuItem, Order, Review } = require('../dist/database/entities');
const { AuthModule } = require('../dist/auth/auth.module');
const { ReviewsModule } = require('../dist/reviews/reviews.module');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const { OrdersService } = require('../dist/orders/orders.service');
const { OrdersController } = require('../dist/orders/orders.controller');
const { OrdersGateway } = require('../dist/orders/gateway/orders.gateway');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), AuthModule, ReviewsModule, RestaurantsModule],
  controllers: [OrdersController], providers: [OrdersService, LoyaltyService, { provide: OrdersGateway, useValue: {} }, { provide: NotificationsService, useValue: {} }] })(TestModule);

async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = [randomUUID(), randomUUID()], restaurantId = randomUUID(), orders = [randomUUID(), randomUUID(), randomUUID()];
  try {
    await app.listen(0, '127.0.0.1');
    const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (const id of users) await ds.getRepository(User).save({ id, email: `${id}@example.invalid`, passwordHash: 'fixture-not-login', fullName: 'Khách kiểm thử review', role: 'customer' });
    await ds.getRepository(Restaurant).save({ id: restaurantId, name: 'Quán kiểm thử review', address: 'Fixture tạm thời', ownerId: users[1], active: true, location: { type: 'Point', coordinates: [106.7, 10.78] } });
    for (const name of ['Cơm fixture', 'Nước fixture']) await ds.getRepository(MenuItem).save({ restaurantId, name, price: 10000, available: true });
    for (let i = 0; i < orders.length; i++) await ds.getRepository(Order).save({ id: orders[i], orderCode: 'TEST-' + orders[i].slice(0, 20), userId: users[0], restaurantId,
      status: i === 2 ? 'PENDING' : 'COMPLETED', pickupType: 'asap', estimatedPickupMinutes: 15, estimatedPickupAt: new Date(), paymentMethod: 'cash', paymentStatus: i === 2 ? 'UNPAID' : 'PAID', subtotal: 10000, totalAmount: 10000, customerName: 'Fixture', customerPhone: '0900000000' });
    const call = async (url, userId, method = 'GET', body) => {
      const response = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: 'Bearer ' + jwt.sign({ sub: userId, role: 'customer' }, { secret, expiresIn: '5m' }) } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await call('/reviews', null, 'POST', { orderId: orders[0], rating: 5 })).status, 401);
    assert.equal((await call('/reviews', users[1], 'POST', { orderId: orders[0], rating: 5 })).status, 403);
    assert.equal((await call('/reviews', users[0], 'POST', { orderId: orders[2], rating: 5 })).status, 409);
    for (const rating of [0, 6, 1.5]) assert.equal((await call('/reviews', users[0], 'POST', { orderId: orders[0], rating })).status, 400);
    assert.equal((await call('/reviews', users[0], 'POST', { orderId: orders[0], rating: 5, comment: 'a'.repeat(1001) })).status, 400);
    assert.ok((await call('/orders', users[0])).data.every((order) => order.hasReview === false));
    const review = await call('/reviews', users[0], 'POST', { orderId: orders[0], rating: 5, comment: '  Món ngon, phục vụ tốt!  ' });
    assert.equal(review.status, 201); assert.equal(review.data.comment, 'Món ngon, phục vụ tốt!');
    assert.equal((await call('/reviews', users[0], 'POST', { orderId: orders[0], rating: 5 })).status, 409);
    const list = (await call('/orders', users[0])).data;
    assert.equal(list.find((order) => order.id === orders[0]).hasReview, true);
    assert.equal(list.find((order) => order.id === orders[1]).hasReview, false);
    assert.equal((await call('/orders/' + orders[0], users[0])).data.hasReview, true);
    assert.equal((await call('/reviews', users[0], 'POST', { orderId: orders[1], rating: 3 })).status, 201);
    const detail = (await call('/restaurants/' + restaurantId)).data;
    assert.equal(Number(detail.rating), 4); assert.equal(detail.reviewCount, 2); assert.equal(detail.reviews.length, 2);
    assert.equal(detail.menuItems.length, 2);
    assert.ok(detail.reviews.some((item) => item.comment === 'Món ngon, phục vụ tốt!'));
    assert.ok(detail.reviews.every((item) => item.customer.fullName === 'Khách kiểm thử review'));
    assert.ok(!JSON.stringify(detail).includes('passwordHash'));
    assert.ok(!JSON.stringify(detail.reviews).includes('@example.invalid'));
    assert.ok(!JSON.stringify(detail.reviews).includes('userId'));
    assert.equal(await ds.getRepository(Review).countBy({ orderId: orders[0] }), 1);
    console.log('PASS: review JWT/ownership/completed-only/duplicates/rating/comment validation; hasReview persists in list/detail; public restaurant reviews + average rating updated.');
  } finally {
    const ds = app.get(DataSource);
    if (ds.isInitialized) { await ds.getRepository(Order).delete({ id: In(orders) }); await ds.getRepository(Restaurant).delete({ id: restaurantId }); await ds.getRepository(User).delete({ id: In(users) }); }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
