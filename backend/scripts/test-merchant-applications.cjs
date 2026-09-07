// Hồ sơ, tài khoản và giấy tờ tự tạo riêng; không dùng dữ liệu cá nhân thật.
require('reflect-metadata');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core'), { Module, ValidationPipe } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm'), { ConfigModule } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt'), { DataSource } = require('typeorm');
const { entities, User, Restaurant } = require('../dist/database/entities');
const { MerchantApplicationsModule } = require('../dist/merchant-applications/merchant-applications.module');
const { MerchantApplication, MerchantApplicationDocument } = require('../dist/merchant-applications/merchant-application.entity');
const { AuthModule } = require('../dist/auth/auth.module');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
process.env.MERCHANT_DOCUMENT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
class TestModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TypeOrmModule.forRoot({ type: 'postgres', url: env.DATABASE_URL, entities, synchronize: false }), AuthModule, MerchantApplicationsModule] })(TestModule);

async function main() {
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  let createdUser;
  try {
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl(), ds = app.get(DataSource);
    const adminUser = await ds.getRepository(User).findOneByOrFail({ role: 'admin' });
    const admin = app.get(JwtService).sign({ sub: adminUser.id, role: 'admin' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' });
    const call = async (url, token, method = 'GET', body) => {
      const response = await fetch(base + '/api' + url, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json().catch(() => null) };
    };
    const email = `partner-fixture-${randomUUID()}@example.invalid`, password = 'Fixture-Only-12345';
    const registered = await call('/auth/register', null, 'POST', { email, password, fullName: 'Đối tác kiểm thử', phone: '0900000000' });
    assert.equal(registered.status, 201); createdUser = registered.data.user.id;
    const customer = registered.data.accessToken;
    const stranger = app.get(JwtService).sign({ sub: adminUser.id, role: 'customer' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' });
    assert.equal((await call('/auth/upgrade-to-merchant', customer, 'POST')).status, 403);
    assert.equal((await call('/admin/merchant-applications', customer)).status, 403);
    assert.equal((await call('/merchant-applications/me')).status, 401);
    const terms = (await call('/merchant-applications/terms')).data;
    const shop = { name: 'Quán fixture ' + randomUUID(), address: 'Địa chỉ kiểm thử', latitude: 10.8, longitude: 106.7, category: 'com', openingHours: '08:00-22:00' };
    assert.equal((await call('/merchant-applications/me', customer, 'PUT', {})).status, 400);
    const saved = await call('/merchant-applications/me', customer, 'PUT', { shop }); assert.equal(saved.status, 200);
    const id = saved.data.id;
    const consent = { termsVersion: terms.version, agreements: { accuracy: true, terms: true, documentReview: true } };
    assert.equal((await call('/merchant-applications/me/submit', customer, 'POST', consent)).status, 400);
    const bank = { bankName: 'Ngân hàng kiểm thử', accountNumber: '0000000000', accountHolder: 'TEST ONLY' };
    assert.equal((await call('/merchant-applications/me/bank', customer, 'PUT', bank)).status, 200);
    const fileBytes = Buffer.from('%PDF-1.4\nFixture only - no identity information\n%%EOF');
    let firstDocument;
    for (const kind of ['identity_front', 'identity_back', 'business_license', 'food_safety']) {
      const data = new FormData(); data.append('file', new Blob([fileBytes], { type: 'application/pdf' }), 'fixture.pdf');
      const uploaded = await call('/merchant-applications/me/documents/' + kind, customer, 'POST', data); assert.equal(uploaded.status, 201);
      firstDocument ||= uploaded.data.documents[0].id;
    }
    const invalid = new FormData(); invalid.append('file', new Blob(['<script>bad</script>'], { type: 'image/png' }), 'bad.png');
    assert.equal((await call('/merchant-applications/me/documents/identity_front', customer, 'POST', invalid)).status, 400);
    const oversized = new FormData(); oversized.append('file', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'large.pdf');
    assert.equal((await call('/merchant-applications/me/documents/identity_front', customer, 'POST', oversized)).status, 413);
    assert.equal((await call('/merchant-applications/me/submit', customer, 'POST', { ...consent, agreements: { ...consent.agreements, terms: false } })).status, 400);
    assert.equal((await call('/merchant-applications/me/submit', customer, 'POST', { ...consent, termsVersion: 'wrong-version' })).status, 409);
    const submitted = await call('/merchant-applications/me/submit', customer, 'POST', consent); assert.equal(submitted.status, 201); assert.equal(submitted.data.status, 'SUBMITTED');
    assert.equal((await call('/merchant-applications/me', customer, 'PUT', { shop })).status, 409);
    assert.equal((await call(`/admin/merchant-applications/${id}/approve`, customer, 'PATCH')).status, 403);
    assert.equal((await ds.getRepository(User).findOneByOrFail({ id: createdUser })).role, 'customer');
    const list = await call('/admin/merchant-applications?status=SUBMITTED', admin); assert.equal(list.status, 200); assert.ok(!JSON.stringify(list.data).includes(bank.accountNumber));
    const dbApp = await ds.getRepository(MerchantApplication).createQueryBuilder('app').addSelect('app.bankEncrypted').where('app.id = :id', { id }).getOneOrFail();
    assert.ok(!dbApp.bankEncrypted.includes(Buffer.from(bank.accountNumber)));
    const dbDoc = await ds.getRepository(MerchantApplicationDocument).createQueryBuilder('doc').addSelect('doc.encryptedContent').where('doc.id = :id', { id: firstDocument }).getOneOrFail();
    assert.ok(!dbDoc.encryptedContent.includes(fileBytes));
    const fileUrl = `${base}/api/merchant-applications/${id}/documents/${firstDocument}`;
    assert.equal((await fetch(fileUrl)).status, 401);
    const ownFile = await fetch(fileUrl, { headers: { Authorization: 'Bearer ' + customer } });
    assert.equal(ownFile.status, 200); assert.equal(ownFile.headers.get('cache-control'), 'no-store'); assert.deepEqual(Buffer.from(await ownFile.arrayBuffer()), fileBytes);
    // Người ngoài hợp lệ không được đọc file: dùng user ID ngẫu nhiên không tồn tại.
    const other = app.get(JwtService).sign({ sub: randomUUID(), role: 'customer' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' });
    assert.equal((await fetch(fileUrl, { headers: { Authorization: 'Bearer ' + other } })).status, 403);
    assert.equal((await call(`/admin/merchant-applications/${id}/reject`, admin, 'PATCH', { reason: 'Cần bổ sung bản rõ nét' })).status, 200);
    assert.equal((await call('/merchant-applications/me', customer)).data.status, 'REJECTED');
    assert.equal((await call('/merchant-applications/me/submit', customer, 'POST', consent)).status, 201);
    const approved = await call(`/admin/merchant-applications/${id}/approve`, admin, 'PATCH'); assert.equal(approved.status, 200); assert.equal(approved.data.status, 'APPROVED');
    assert.equal((await call(`/admin/merchant-applications/${id}/approve`, admin, 'PATCH')).status, 200);
    assert.equal(await ds.getRepository(Restaurant).countBy({ ownerId: createdUser }), 1);
    const login = await call('/auth/login', null, 'POST', { email, password }); assert.equal(login.status, 201); assert.equal(login.data.user.role, 'merchant');
    assert.equal((await call('/merchant-applications/me/submit', customer, 'POST', consent)).status, 409);
    console.log('PASS: signup customer, blocked self-upgrade, draft/documents/encryption/private downloads, MIME/size checks, consent/version gate, submit locks, reject/resubmit, admin-only idempotent approval and merchant login.');
  } finally {
    if (createdUser) await app.get(DataSource).getRepository(User).delete({ id: createdUser });
    await app.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
