// API + PostgreSQL thật; chỉ tạo và dọn fixture có UUID riêng của lần chạy này.
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
const { entities, User, Restaurant, MenuItem } = require('../dist/database/entities');
const { Favorite } = require('../dist/favorites/favorite.entity');
const { FavoritesModule } = require('../dist/favorites/favorites.module');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const env = require('dotenv').parse(readFileSync(join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex');
process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), FavoritesModule, RestaurantsModule] })(TestModule);
async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const users = [randomUUID(), randomUUID()], shops = [randomUUID(), randomUUID(), randomUUID()];
  const keyword = 'Mì trộn ' + randomUUID();
  try {
    await app.listen(0, '127.0.0.1');
    const ds = app.get(DataSource), jwt = app.get(JwtService), base = await app.getUrl();
    for (const id of users) await ds.getRepository(User).save({ id, email: `${id}@example.invalid`, passwordHash: 'fixture-not-login', fullName: 'Kiểm thử yêu thích', role: 'customer' });
    for (let i = 0; i < shops.length; i++) {
      await ds.getRepository(Restaurant).save({ id: shops[i], name: 'Quán fixture ' + shops[i], address: 'Địa chỉ kiểm thử', ownerId: users[0], active: i !== 2, location: { type: 'Point', coordinates: [106.7, 10.78] } });
      for (const name of [keyword, keyword + ' đặc biệt', 'Nước chanh không khớp']) await ds.getRepository(MenuItem).save({ restaurantId: shops[i], name, price: 25000, available: true });
    }
    const token = (sub) => jwt.sign({ sub, role: 'customer' }, { secret, expiresIn: '5m' });
    const call = async (url, sub, method = 'GET') => {
      const res = await fetch(base + '/api' + url, { method, headers: sub ? { Authorization: 'Bearer ' + token(sub) } : {} });
      return { status: res.status, data: await res.json() };
    };
    for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await call('/favorites' + (method === 'GET' ? '' : '/' + shops[0]), null, method)).status, 401);
    assert.equal((await call('/favorites', randomUUID())).status, 401);
    assert.equal((await call('/favorites/not-a-uuid', users[0], 'POST')).status, 400);
    assert.equal((await call('/favorites/' + randomUUID(), users[0], 'POST')).status, 404);
    assert.equal((await call('/favorites/' + shops[2], users[0], 'POST')).status, 404);
    const search = (await call('/restaurants?search=' + encodeURIComponent(keyword.toUpperCase()))).data;
    assert.equal(search.total, 2); assert.equal(search.data.length, 2);
    assert.ok(search.data.every((shop) => shop.menuItems.length === 3));
    const pages = await Promise.all([1, 2].map((page) => call('/restaurants?limit=1&page=' + page + '&search=' + encodeURIComponent(keyword))));
    assert.notEqual(pages[0].data.data[0].id, pages[1].data.data[0].id);
    assert.equal((await call('/restaurants?search=' + shops[0])).data.total, 1);
    const adds = await Promise.all(Array.from({ length: 3 }, () => call('/favorites/' + shops[0], users[0], 'POST')));
    assert.ok(adds.every((res) => res.status === 201));
    assert.equal(await ds.getRepository(Favorite).countBy({ userId: users[0], restaurantId: shops[0] }), 1);
    const saved = (await call('/favorites', users[0])).data;
    assert.equal(saved[0].id, shops[0]); assert.equal(saved[0].name, 'Quán fixture ' + shops[0]);
    assert.ok(!JSON.stringify(saved).includes('passwordHash'));
    assert.deepEqual((await call('/favorites', users[1])).data, []);
    await call('/favorites/' + shops[0], users[1], 'DELETE');
    assert.equal((await call('/favorites', users[0])).data.length, 1);
    await ds.getRepository(Restaurant).update(shops[0], { active: false });
    assert.equal((await call('/favorites', users[0])).data[0].active, false);
    for (let i = 0; i < 2; i++) assert.equal((await call('/favorites/' + shops[0], users[0], 'DELETE')).status, 200);
    assert.deepEqual((await call('/favorites', users[0])).data, []);
    console.log('PASS: real dish/name search, full menus, distinct pagination; JWT, UUID, inactive/missing shop, concurrent deduplication, account isolation and idempotent unfavorite.');
  } finally {
    const ds = app.get(DataSource);
    if (ds.isInitialized) { await ds.getRepository(Restaurant).delete({ id: In(shops) }); await ds.getRepository(User).delete({ id: In(users) }); }
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
