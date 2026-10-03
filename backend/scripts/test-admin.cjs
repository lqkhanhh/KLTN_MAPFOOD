// API thật + database hiện tại, chỉ tạo/xóa quán và log fixture riêng.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { JwtService } = require('@nestjs/jwt');
const { DataSource, In } = require('typeorm');
const { entities, Restaurant, RouteSearchLog, User } = require('../dist/database/entities');
const { AdminModule } = require('../dist/admin/admin.module');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const { SearchModule } = require('../dist/search/search.module');
const { SearchService } = require('../dist/search/search.service');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex');
process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), AdminModule, RestaurantsModule, SearchModule] })(TestModule);

async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const fixtureId = randomUUID(), logIds = [];
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl(), ds = app.get(DataSource), jwt = app.get(JwtService);
    const owner = await ds.getRepository(User).findOneByOrFail({ email: 'merchant@routebite.local' });
    const token = (role) => jwt.sign({ sub: owner.id, role, email: 'fixture@example.invalid' }, { secret, expiresIn: '5m' });
    const admin = token('admin');
    const call = async (url, bearer, method = 'GET', body) => {
      const result = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: result.status, data: await result.json() };
    };
    for (const url of ['/admin/dashboard/overview', '/admin/search-analytics', '/admin/users', '/admin/restaurants']) {
      assert.equal((await call(url)).status, 401);
      for (const role of ['customer', 'merchant']) assert.equal((await call(url, token(role))).status, 403);
      assert.equal((await call(url, admin)).status, 200, url);
    }
    const overview = (await call('/admin/dashboard/overview', admin)).data;
    assert.ok(Array.isArray(overview.usersByRole)); assert.equal(typeof overview.gmv, 'number');
    const users = (await call('/admin/users?role=merchant&page=1&limit=1', admin)).data;
    assert.equal(users.limit, 1); assert.ok(users.data.every((user) => user.role === 'merchant'));
    assert.ok(!JSON.stringify(users).includes('passwordHash'));
    const shop = await ds.getRepository(Restaurant).save(ds.getRepository(Restaurant).create({ id: fixtureId, ownerId: owner.id, name: 'Admin fixture ' + fixtureId, address: 'Dữ liệu kiểm thử tạm', location: { type: 'Point', coordinates: [106.7, 10.8] }, active: true, source: 'demo' }));
    // Chỉ giả lập nhà cung cấp chỉ đường; vẫn kiểm thử SQL không gian thực tế.
    const search = app.get(SearchService);
    search.directions = async () => ({ line: 'LINESTRING(106.7 10.799,106.7 10.801)', polyline: '', provider: 'test-fixture', travelTimeMinutes: 1, durationSeconds: 60, distanceMeters: 250 });
    const originalSave = search.logs.save.bind(search.logs);
    search.logs.save = async (log) => { const saved = await originalSave(log); logIds.push(saved.id); return saved; };
    const visible = async (expected) => {
      const list = await call('/restaurants?search=' + encodeURIComponent(fixtureId));
      assert.equal(list.data.data.some((item) => item.id === fixtureId), expected);
      const route = await call('/search/route', undefined, 'POST', { pointA: { latitude: 10.799, longitude: 106.7 }, pointB: { latitude: 10.801, longitude: 106.7 }, radius: 500 });
      assert.equal(route.status, 201); assert.equal(route.data.restaurants.some((item) => item.id === fixtureId), expected);
    };
    await visible(true);
    for (const action of ['suspend', 'activate']) {
      for (const role of ['customer', 'merchant']) assert.equal((await call(`/admin/restaurants/${fixtureId}/${action}`, token(role), 'PATCH', action === 'suspend' ? { reason: 'Test owner guard' } : undefined)).status, 403);
    }
    assert.equal((await call(`/admin/restaurants/${fixtureId}/suspend`, admin, 'PATCH', { reason: 'abc' })).status, 400);
    const suspended = await call(`/admin/restaurants/${fixtureId}/suspend`, admin, 'PATCH', { reason: 'Kiểm thử tạm ngưng' });
    assert.equal(suspended.status, 200); assert.equal(suspended.data.active, false);
    await visible(false);
    const activated = await call(`/admin/restaurants/${fixtureId}/activate`, admin, 'PATCH');
    assert.equal(activated.status, 200); assert.equal(activated.data.active, true);
    assert.equal(activated.data.suspendedReason, null); assert.equal(activated.data.suspendedAt, null);
    await visible(true);
    assert.equal(shop.id, fixtureId);
    console.log('PASS: real admin APIs/role guards/pagination/safe users; fixture hidden from public list + spatial route search when suspended, restored when activated.');
  } finally {
    const ds = app.get(DataSource);
    if (ds.isInitialized) {
      if (logIds.length) await ds.getRepository(RouteSearchLog).delete({ id: In(logIds) });
      await ds.getRepository(Restaurant).delete({ id: fixtureId });
    }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
