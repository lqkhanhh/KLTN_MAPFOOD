// Kiểm thử bảo vệ đình chỉ bằng PostgreSQL thật; mọi thay đổi chỉ trên fixture UUID riêng.
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
const { entities, User, Restaurant, MenuItem, Order, RouteSearchLog } = require('../dist/database/entities');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const { AdminModule } = require('../dist/admin/admin.module');
const { OrdersModule } = require('../dist/orders/orders.module');
const { SearchModule } = require('../dist/search/search.module');
const { SearchService } = require('../dist/search/search.service');
const { FavoritesModule } = require('../dist/favorites/favorites.module');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret; delete process.env.GOOGLE_MAPS_API_KEY;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), RestaurantsModule, AdminModule, OrdersModule, SearchModule, FavoritesModule] })(TestModule);
async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = [randomUUID(), randomUUID(), randomUUID()], roles = ['merchant', 'admin', 'customer'], shopId = randomUUID(), menuId = randomUUID();
  try {
    await app.listen(0, '127.0.0.1'); const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (let i = 0; i < users.length; i++) await ds.getRepository(User).save({ id: users[i], email: `${users[i]}@example.invalid`, passwordHash: 'fixture-no-login', fullName: 'Suspension fixture', phone: '0900000000', role: roles[i] });
    await ds.getRepository(Restaurant).save({ id: shopId, name: 'Suspension ' + shopId, address: 'Địa chỉ fixture', ownerId: users[0], active: true, location: { type: 'Point', coordinates: [106.7, 10.78] } });
    await ds.getRepository(MenuItem).save({ id: menuId, restaurantId: shopId, name: 'Món fixture', price: 10000, available: true });
    const call = async (path, i = 0, method = 'GET', body) => {
      const response = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(i === null ? {} : { Authorization: 'Bearer ' + jwt.sign({ sub: users[i], role: roles[i] }, { secret, expiresIn: '5m' }) }) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const payload = { name: 'Suspension ' + shopId, address: 'Địa chỉ fixture', latitude: 10.78, longitude: 106.7, openingHours: '08:00-22:00' };
    const update = (extra, i = 0) => call('/restaurants/' + shopId, i, 'PUT', { ...payload, ...extra });
    const suspend = () => call('/admin/restaurants/' + shopId + '/suspend', 1, 'PATCH', { reason: 'Vi phạm cần kiểm tra lại' });
    const activate = (i = 1) => call('/admin/restaurants/' + shopId + '/activate', i, 'PATCH');
    // Quán merchant tự đóng vẫn được mở bình thường khi không có đình chỉ của admin.
    assert.equal((await update({ active: false })).status, 200); assert.equal((await update({ active: true })).status, 200);
    assert.equal((await suspend()).status, 200);
    // Đường dẫn menu trực tiếp phải bị chặn, không chỉ danh sách tìm kiếm.
    for (const actor of [null, 0, 1, 2]) assert.equal((await call('/restaurants/' + shopId, actor)).status, 403);
    assert.equal((await call('/restaurants/' + shopId + '/manage', null)).status, 401);
    assert.equal((await call('/restaurants/' + shopId + '/manage', 2)).status, 403);
    for (const actor of [0, 1]) assert.equal((await call('/restaurants/' + shopId + '/manage', actor)).status, 200);
    const outsider = randomUUID();
    await ds.getRepository(Restaurant).save({ id: outsider, name: 'Quán của merchant khác', address: 'Fixture', ownerId: users[1], location: { type: 'Point', coordinates: [106.7, 10.78] } });
    try { assert.equal((await call('/restaurants/' + outsider + '/manage', 0)).status, 403); }
    finally { await ds.getRepository(Restaurant).delete(outsider); }
    assert.equal((await update({ active: true })).status, 403);
    assert.equal((await update({ active: true }, 1)).status, 403); // Admin cũng phải dùng endpoint gỡ đình chỉ riêng.
    assert.equal((await activate(0)).status, 403); assert.equal((await activate(2)).status, 403);
    for (const extra of [{ active: true, suspendedAt: null }, { suspendedReason: null }, { ownerId: users[1] }]) assert.equal((await update(extra)).status, 400);
    // Lưu menu/ảnh không thay đổi quyết định admin.
    const saved = await update({ imageUrl: '/fixture.png', menuItems: [{ id: menuId, name: 'Món mới', price: 20000, available: true }] });
    assert.equal(saved.status, 200); assert.equal(saved.data.active, false); assert.ok(saved.data.suspendedAt); assert.equal(saved.data.suspendedReason, 'Vi phạm cần kiểm tra lại');
    assert.equal((await update({ active: false })).status, 200);
    assert.equal((await call('/restaurants?search=' + shopId, null)).data.total, 0);
    const route = await app.get(SearchService).route({ pointA: { latitude: 10.78, longitude: 106.699 }, pointB: { latitude: 10.78, longitude: 106.701 }, radius: 500 }, users[2]);
    assert.ok(!route.restaurants.some((r) => r.id === shopId));
    assert.equal((await call('/orders', 2, 'POST', { restaurantId: shopId, pickupOption: { type: 'asap', estimatedPickupMinutes: 15 }, payment: { method: 'cash' }, items: [{ menuItemId: menuId, quantity: 1 }] })).status, 409);
    assert.equal((await call('/favorites/' + shopId, 2, 'POST')).status, 404);
    await assert.rejects(ds.getRepository(Restaurant).update(shopId, { active: true }), (error) => error.code === '23514');
    assert.equal((await activate()).status, 200);
    const reopened = await ds.getRepository(Restaurant).findOneByOrFail({ id: shopId }); assert.equal(reopened.active, true); assert.equal(reopened.suspendedAt, null); assert.equal(reopened.suspendedReason, null);
    assert.equal((await call('/restaurants?search=' + shopId, null)).data.total, 1);
    assert.equal((await call('/restaurants/' + shopId, null)).status, 200);
    for (let i = 0; i < 5; i++) {
      await activate(); const results = await Promise.all([suspend(), update({ active: true })]);
      assert.equal(results[0].status, 200); assert.ok([200, 403].includes(results[1].status));
      const row = await ds.getRepository(Restaurant).findOneByOrFail({ id: shopId }); assert.equal(row.active, false); assert.ok(row.suspendedAt);
    }
    assert.equal((await ds.getRepository(MenuItem).findOneByOrFail({ id: menuId })).name, 'Món mới');
    console.log('PASS: merchant cannot reopen suspended shop or clear moderation fields; own pause/reopen works; menu/image preserves suspension; admin-only dedicated reactivation; discovery/search/new orders/favorites blocked; DB invariant and concurrent suspend/update verified.');
  } finally {
    const ds = app.get(DataSource); if (ds.isInitialized) {
      await ds.getRepository(RouteSearchLog).delete({ userId: In(users) }); await ds.getRepository(Order).delete({ restaurantId: shopId });
      await ds.getRepository(Restaurant).delete({ id: shopId }); await ds.getRepository(User).delete({ id: In(users) });
    } await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
