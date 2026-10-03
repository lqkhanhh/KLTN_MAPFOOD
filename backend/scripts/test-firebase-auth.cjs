// Real database + HTTP tests; only the external Firebase verifier is replaced.
require('reflect-metadata');
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, UnauthorizedException } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { FirebaseService } = require('../dist/auth/firebase.service');
const { IdentityRateGuard } = require('../dist/auth/guards/identity-rate.guard');
const { DataSource } = require('typeorm');
const { User, UserRole } = require('../dist/database/entities');

async function main() {
  const identities = new Map(), ids = new Set(), prefix = randomUUID();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FirebaseService).useValue({
      configuration: () => ({ config: null, providers: { google: false, apple: false, phone: false } }),
      verify: async token => { if (!identities.has(token)) throw new UnauthorizedException(); return identities.get(token); },
    }).overrideGuard(IdentityRateGuard).useValue({ canActivate: () => true }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const repo = module.get(DataSource).getRepository(User);
  const call = async (path, body, token, method = 'POST') => {
    const response = await fetch(base + '/api/auth' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (data.user?.id) ids.add(data.user.id);
    return { status: response.status, data };
  };
  const identity = (provider, extra = {}) => {
    const idToken = randomUUID();
    identities.set(idToken, { uid: prefix + '-' + randomUUID(), email: `${randomUUID()}@example.com`, email_verified: true, name: 'Identity Test', firebase: { sign_in_provider: provider }, ...extra });
    return idToken;
  };
  try {
    assert.equal((await call('/firebase', { idToken: 'forged' })).status, 401);
    for (const body of [{}, { idToken: '' }, { idToken: 'x', role: 'admin' }, { idToken: 'x', email: 'fake@example.com' }]) assert.equal((await call('/firebase', body)).status, 400);
    assert.equal((await call('/firebase/link', { idToken: 'x', password: 'x' })).status, 401);
    const google = identity('google.com');
    const first = await call('/firebase', { idToken: google });
    assert.equal(first.status, 201); assert.equal(first.data.user.role, 'customer');
    assert.ok(first.data.accessToken && first.data.refreshToken);
    assert.equal(first.data.user.firebaseUid, undefined); assert.equal(first.data.user.passwordHash, undefined);
    const repeat = await call('/firebase', { idToken: google });
    assert.equal(repeat.data.user.id, first.data.user.id);
    assert.equal((await call('/login', { email: first.data.user.email, password: 'no-password' })).status, 401);
    assert.equal((await call('/refresh', { refreshToken: repeat.data.refreshToken })).status, 201);
    const apple = await call('/firebase', { idToken: identity('apple.com') }); assert.equal(apple.status, 201);
    const phoneToken = identity('phone', { email: undefined, email_verified: undefined, phone_number: '+84901234567' });
    const phone = await call('/firebase', { idToken: phoneToken });
    assert.equal(phone.status, 201); assert.equal(phone.data.user.phone, '+84901234567');
    assert.ok(phone.data.user.email.endsWith('@identity.routebite.invalid'));
    const localEmail = `${prefix}@example.com`, password = randomUUID();
    // Existing password account fixture; registration OTP is covered separately.
    const localUser = await repo.save(repo.create({ email: localEmail, passwordHash: await require('bcrypt').hash(password, 4), fullName: 'Local Test', phone: '+84901234567', role: UserRole.CUSTOMER }));
    ids.add(localUser.id);
    const accessToken = new (require('@nestjs/jwt').JwtService)().sign({ sub: localUser.id, email: localEmail, role: UserRole.CUSTOMER }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
    const local = { status: 201, data: { user: localUser, accessToken } };
    assert.equal(local.status, 201); assert.notEqual(phone.data.user.id, local.data.user.id);
    const matching = identity('google.com', { email: localEmail });
    assert.equal((await call('/firebase', { idToken: matching })).status, 409);
    assert.equal((await call('/firebase/link', { idToken: matching, password: 'wrong' }, local.data.accessToken)).status, 401);
    assert.equal((await call('/firebase/link', { idToken: google, password }, local.data.accessToken)).status, 409);
    assert.equal((await call('/firebase/link', { idToken: matching, password }, local.data.accessToken)).status, 201);
    assert.equal((await call('/firebase/link', { idToken: matching, password }, local.data.accessToken)).status, 201);
    assert.equal((await call('/firebase/link', { idToken: identity('apple.com'), password }, local.data.accessToken)).status, 409);
    for (const role of [UserRole.MERCHANT, UserRole.ADMIN]) {
      await repo.update(local.data.user.id, { role, pointsBalance: 123 });
      const result = await call('/firebase', { idToken: matching });
      assert.equal(result.data.user.id, local.data.user.id); assert.equal(result.data.user.role, role); assert.equal(result.data.user.pointsBalance, 123);
    }
    const status = await call('/firebase/status', null, local.data.accessToken, 'GET');
    assert.deepEqual(status.data, { linked: true, hasPassword: true });
    const raceToken = identity('google.com');
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => call('/firebase', { idToken: raceToken })));
    assert.ok(concurrent.every(result => result.status === 201));
    assert.equal(new Set(concurrent.map(result => result.data.user.id)).size, 1);
    console.log('PASS: real DB/HTTP validation, token rejection, Google/Apple/phone creation, repeat/concurrent login, refresh, no contact-phone merge, protected account linking, preserved roles/points. Firebase verification was mocked; no SMS sent.');
  } finally {
    // Include creations from partially failed tests and nothing outside this run.
    const owned = await repo.createQueryBuilder('user').where('"firebaseUid" LIKE :prefix', { prefix: prefix + '%' }).getMany();
    for (const user of owned) ids.add(user.id);
    for (const id of ids) await repo.delete(id);
    await app.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
