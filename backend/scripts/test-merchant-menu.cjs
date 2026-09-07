// Kiểm thử API bằng quán fixture riêng; không chỉnh menu/quán hiện có.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const { randomUUID, randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core'); const { Module, ValidationPipe } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm'); const { ConfigModule } = require('@nestjs/config'); const { JwtService } = require('@nestjs/jwt');
const { DataSource, In } = require('typeorm');
const { entities, Restaurant, MenuItem, User } = require('../dist/database/entities');
const { RestaurantsModule } = require('../dist/restaurants/restaurants.module');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const secret = randomBytes(32).toString('hex'); process.env.JWT_ACCESS_SECRET = secret;
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), RestaurantsModule] })(TestModule);
async function main() {
  const app = await NestFactory.create(TestModule, { logger: false }); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const created = [];
  try {
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl(); const ds = app.get(DataSource);
    const owner = await ds.getRepository(User).findOneByOrFail({ email: 'merchant@routebite.local' });
    const jwt = app.get(JwtService);
    const token = (sub, role) => jwt.sign({ sub, role, email: 'fixture@example.invalid' }, { secret, expiresIn: '5m' });
    const merchant = token(owner.id, 'merchant'), other = token(randomUUID(), 'merchant'), customer = token(randomUUID(), 'customer');
    const call = async (url, bearer, method = 'GET', body) => {
      const response = await fetch(base + '/api/restaurants' + url, { method, headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const payload = { name: 'Fixture merchant ' + randomUUID(), address: 'Dữ liệu kiểm thử', latitude: 10.8, longitude: 106.7, openingHours: '08:00-22:00', category: 'com', active: false,
      imageUrl: 'https://example.com/restaurant.png', menuItems: [{ name: 'Món A', price: 10000, available: true, imageUrl: 'https://example.com/food.png' }, { name: 'Món B', price: 20000, available: true }] };
    assert.equal((await call('', customer, 'POST', payload)).status, 403);
    const first = await call('', merchant, 'POST', payload); assert.equal(first.status, 201); created.push(first.data.id);
    const id = first.data.id; const [a, b] = first.data.menuItems;
    assert.equal(first.data.imageUrl, payload.imageUrl); assert.equal(a.imageUrl, 'https://example.com/food.png');
    const updated = await call('/' + id, merchant, 'PUT', { ...payload, menuItems: [{ id: a.id, name: 'Món A đã sửa', price: 15000, available: false }, { name: 'Món C', price: 30000, available: true }] });
    assert.equal(updated.status, 200); assert.equal(updated.data.menuItems.length, 2);
    assert.ok(updated.data.menuItems.some((item) => item.id === a.id && !item.available && item.price === 15000));
    assert.equal(await ds.getRepository(MenuItem).countBy({ id: b.id }), 0);
    assert.equal((await call('/' + id, other, 'PUT', payload)).status, 403);
    const second = await call('', merchant, 'POST', { ...payload, name: payload.name + ' B' }); assert.equal(second.status, 201); created.push(second.data.id);
    const hijack = await call('/' + id, merchant, 'PUT', { ...payload, name: 'Must roll back', menuItems: [{ id: second.data.menuItems[0].id, name: 'Hijack', price: 1 }] });
    assert.equal(hijack.status, 400);
    assert.equal((await call('/' + id, merchant)).data.name, payload.name);
    assert.equal((await call('', merchant, 'POST', { ...payload, menuItems: [{ id: a.id, name: 'Bad', price: 1 }] })).status, 400);
    assert.equal((await call('/' + id, merchant, 'PUT', { ...payload, imageUrl: 'javascript:alert(1)', menuItems: [] })).status, 400);
    assert.equal((await call('/' + id, merchant, 'PUT', { ...payload, menuItems: [{ name: 'Bad image', price: 1, imageUrl: 'data:image/png;base64,test' }] })).status, 400);
    const empty = await call('/' + id, merchant, 'PUT', { ...payload, imageUrl: null, menuItems: [] }); assert.equal(empty.status, 200); assert.equal(empty.data.menuItems.length, 0); assert.equal(empty.data.imageUrl, null);
    console.log('PASS: actual POST/PUT API, add/edit/remove/toggle/empty menu, role + ownership checks, cross-restaurant IDs rejected and rolled back.');
  } finally {
    const ds = app.get(DataSource);
    if (created.length && ds.isInitialized) await ds.getRepository(Restaurant).delete({ id: In(created) });
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
