// Real PostgreSQL + HTTP; Brevo delivery only is mocked. OTP tables are isolated in a temporary schema.
require('reflect-metadata'); require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, ServiceUnavailableException } = require('@nestjs/common');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');
const { EmailOtpService } = require('../dist/auth/email-otp.service');
const { IdentityRateGuard } = require('../dist/auth/guards/identity-rate.guard');
const { AddEmailOtp1789300000000 } = require('../dist/database/migrations/1789300000000-AddEmailOtp');
const { User } = require('../dist/database/entities');

async function main() {
  const schema = 'otp_test_' + randomUUID().replaceAll('-', '');
  const rootDb = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL });
  await rootDb.initialize();
  await rootDb.query(`CREATE SCHEMA "${schema}"`);
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, extra: { options: `-c search_path=${schema},public` } });
  let app; const ids = [], mails = new Map(); let fail = false;
  process.env.EMAIL_OTP_SECRET = randomUUID() + randomUUID();
  process.env.EMAIL_OTP_DAILY_LIMIT = '250';
  const brevo = { enabled: () => true, sendCode: async (email, code) => { if (fail) throw new ServiceUnavailableException('Mail unavailable'); mails.set(email, code); } };
  try {
    await db.initialize();
    const runner = db.createQueryRunner();
    try { await new AddEmailOtp1789300000000().up(runner); } finally { await runner.release(); }
    const otp = new EmailOtpService(db, brevo);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailOtpService).useValue(otp)
      .overrideGuard(IdentityRateGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
    const repo = module.get(DataSource).getRepository(User);
    const email = () => `otp-${randomUUID()}@example.com`;
    const rawCall = async (path, body) => {
      const response = await fetch(base + '/api/auth' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); if (data.user?.id) ids.push(data.user.id);
      return { status: response.status, data };
    };
    // Complete registration for the existing login regression fixtures.
    const call = async (path, body) => {
      const result = await rawCall(path, body);
      if (path !== '/register' || result.status !== 201) return result;
      const normalized = body.email.trim().toLowerCase();
      const verified = await rawCall('/register/verify', { registrationTicket: result.data.registrationTicket, code: mails.get(normalized) });
      await db.query('DELETE FROM auth_email_otps WHERE email = $1', [normalized]);
      return verified;
    };

    const registrationEmail = email(), registrationPassword = randomUUID();
    const begin = await rawCall('/register', { email: ' ' + registrationEmail.toUpperCase() + ' ', password: registrationPassword, fullName: ' New Customer ', phone: '0901234567' });
    assert.equal(begin.status, 201); assert.equal(begin.data.requiresOtp, true);
    assert.equal(begin.data.accessToken, undefined); assert.equal(begin.data.user, undefined);
    assert.equal(await repo.findOneBy({ email: registrationEmail }), null);
    assert.ok(!JSON.stringify(begin.data).includes(registrationPassword));
    assert.ok(!Buffer.from(begin.data.registrationTicket, 'base64url').toString('utf8').includes(registrationEmail));
    const registerVerify = (ticket, code) => rawCall('/register/verify', { registrationTicket: ticket, code });
    assert.equal((await rawCall('/email-otp/verify', { loginTicket: begin.data.registrationTicket, code: mails.get(registrationEmail) })).status, 401);
    assert.equal((await registerVerify('tampered', '123456')).status, 401);
    const wrongRegistrationCode = mails.get(registrationEmail) === '000000' ? '111111' : '000000';
    assert.equal((await registerVerify(begin.data.registrationTicket, wrongRegistrationCode)).status, 401);
    assert.equal(await repo.findOneBy({ email: registrationEmail }), null);
    assert.equal((await rawCall('/register/resend', { registrationTicket: begin.data.registrationTicket })).status, 429);
    await db.query(`UPDATE auth_email_otps SET "sentAt" = now() - interval '61 seconds' WHERE email = $1`, [registrationEmail]);
    const resent = await rawCall('/register/resend', { registrationTicket: begin.data.registrationTicket });
    assert.equal(resent.status, 201);
    assert.equal((await registerVerify(begin.data.registrationTicket, mails.get(registrationEmail))).status, 401);
    const completions = await Promise.all(Array.from({ length: 3 }, () => registerVerify(resent.data.registrationTicket, mails.get(registrationEmail))));
    assert.equal(completions.filter(r => r.status === 201).length, 1);
    assert.equal(completions.filter(r => r.status === 401).length, 2);
    const created = completions.find(r => r.status === 201).data;
    assert.equal(created.user.role, 'customer'); assert.equal(created.user.fullName, 'New Customer');
    assert.equal(created.user.phone, '0901234567'); assert.ok(created.accessToken && created.refreshToken);
    assert.equal(created.user.passwordHash, undefined);
    const saved = await repo.findOneBy({ email: registrationEmail });
    assert.ok(await require('bcrypt').compare(registrationPassword, saved.passwordHash));
    assert.equal((await rawCall('/register', { email: registrationEmail, password: registrationPassword, fullName: 'Other' })).status, 409);
    const expEmail = email();
    const exp = await rawCall('/register', { email: expEmail, password: registrationPassword, fullName: 'Expired' });
    await db.query(`UPDATE auth_email_otps SET "expiresAt" = now() - interval '1 second' WHERE email = $1`, [expEmail]);
    assert.equal((await registerVerify(exp.data.registrationTicket, mails.get(expEmail))).status, 401);
    assert.equal(await repo.findOneBy({ email: expEmail }), null);
    fail = true; const failedRegistrationEmail = email();
    assert.equal((await rawCall('/register', { email: failedRegistrationEmail, password: registrationPassword, fullName: 'Failed' })).status, 503);
    fail = false; assert.equal(await repo.findOneBy({ email: failedRegistrationEmail }), null);
    assert.equal((await rawCall('/register', { email: email(), password: registrationPassword, fullName: ' ', role: 'admin' })).status, 400);
    console.log('PASS: registration creates no account/session until OTP, encrypted pending profile, normalization, wrong/tampered/cross-purpose/expired OTP, resend, one concurrent completion, preserved profile/password, duplicate email and delivery failure.');
    const passwords = new Map();
    const requestCode = async value => {
      const normalized=value.trim().toLowerCase();
      if(!passwords.has(normalized)) {
        const password=randomUUID();
        const account=await call('/register',{email:normalized,password,fullName:'OTP Test'});
        if(account.status!==201)return account;
        passwords.set(normalized,password);
      }
      return call('/login',{email:value.trim(),password:passwords.get(normalized)});
    };
    const verify = (value, challenge, code = mails.get(value)) => call('/email-otp/verify', { loginTicket: challenge.data.loginTicket, code });
    const age = value => db.query(`UPDATE auth_email_otps SET "sentAt" = now() - interval '61 seconds' WHERE email = $1`, [value]);
    assert.equal((await requestCode('invalid')).status, 400);
    assert.equal((await call('/email-otp/request', { email: email() })).status, 410);
    assert.equal((await call('/email-otp/verify',{email:email(),challengeId:randomUUID(),code:'123456'})).status,400);
    const firstEmail = email(), challenge = await requestCode(' ' + firstEmail.toUpperCase() + ' ');
    assert.equal(challenge.status, 201); assert.equal(challenge.data.code, undefined); assert.equal(challenge.data.accessToken,undefined); assert.equal(challenge.data.refreshToken,undefined); assert.equal(challenge.data.requiresOtp,true);
    assert.equal((await call('/login',{email:firstEmail,password:'wrong'})).status,401);
    assert.equal((await call('/refresh',{refreshToken:challenge.data.loginTicket})).status,401);
    assert.equal((await requestCode(firstEmail)).status, 429);
    const [stored] = await db.query('SELECT * FROM auth_email_otps WHERE email = $1', [firstEmail]);
    assert.equal(stored.codeHash.length, 64); assert.notEqual(stored.codeHash, mails.get(firstEmail));
    const session = await verify(firstEmail, challenge); assert.equal(session.status, 201); assert.equal(session.data.user.role, 'customer');
    assert.equal((await verify(firstEmail, challenge)).status, 401);
    assert.equal((await call('/refresh', { refreshToken: session.data.refreshToken })).status, 201);
    const lockEmail = email(), locked = await requestCode(lockEmail);
    const wrong = mails.get(lockEmail) === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await verify(lockEmail, locked, wrong)).status, 401);
    assert.equal((await verify(lockEmail, locked)).status, 401);
    const [lockedRow] = await db.query('SELECT attempts, consumed FROM auth_email_otps WHERE email = $1', [lockEmail]);
    assert.equal(lockedRow.attempts, 5); assert.equal(lockedRow.consumed, true);
    const expiredEmail = email(), expired = await requestCode(expiredEmail);
    await db.query(`UPDATE auth_email_otps SET "expiresAt" = now() - interval '1 second' WHERE email = $1`, [expiredEmail]);
    assert.equal((await verify(expiredEmail, expired)).status, 401);
    const resendEmail = email(), old = await requestCode(resendEmail), oldCode = mails.get(resendEmail);
    await age(resendEmail); const fresh = await requestCode(resendEmail);
    assert.equal((await verify(resendEmail, old, oldCode)).status, 401);
    assert.equal((await call('/email-otp/verify',{loginTicket:'forged',code:mails.get(resendEmail)})).status,401);
    assert.equal((await verify(resendEmail, fresh)).status, 201);
    for (let i = 0; i < 3; i++) { await age(resendEmail); assert.equal((await requestCode(resendEmail)).status, 201); }
    await age(resendEmail); assert.equal((await requestCode(resendEmail)).status, 429);
    fail = true; const failedEmail = email(); assert.equal((await requestCode(failedEmail)).status, 503); fail = false;
    const [failed] = await db.query('SELECT consumed, delivered FROM auth_email_otps WHERE email = $1', [failedEmail]);
    assert.equal(failed.consumed, true); assert.equal(failed.delivered, false);
    const raceEmail = email(), race = await requestCode(raceEmail);
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => verify(raceEmail, race)));
    assert.equal(concurrent.filter(result => result.status === 201).length, 1);
    assert.equal(concurrent.filter(result => result.status === 401).length, 3);
    const sendRaceEmail = email(); const racePassword=randomUUID(); await call('/register',{email:sendRaceEmail,password:racePassword,fullName:'Race Test'}); passwords.set(sendRaceEmail,racePassword);
    const sendRace = await Promise.all(Array.from({ length: 3 }, () => requestCode(sendRaceEmail)));
    assert.equal(sendRace.filter(result => result.status === 201).length, 1);
    for (const role of ['customer', 'merchant', 'admin']) {
      const accountEmail = email();
      const localPassword=randomUUID(); const local = await call('/register', { email: accountEmail, password: localPassword, fullName: 'OTP test' }); passwords.set(accountEmail,localPassword);
      assert.equal(local.status, 201); await repo.update(local.data.user.id, { role, pointsBalance: 42 });
      const login = await verify(accountEmail, await requestCode(accountEmail));
      assert.equal(login.status, 201); assert.equal(login.data.user.id, local.data.user.id); assert.equal(login.data.user.role, role); assert.equal(login.data.user.pointsBalance, 42);
    }
    const resendTicketEmail = email(), beforeResend = await requestCode(resendTicketEmail);
    await age(resendTicketEmail);
    const afterResend = await call('/email-otp/resend', { loginTicket: beforeResend.data.loginTicket });
    assert.equal(afterResend.status, 201);
    assert.equal((await verify(resendTicketEmail, beforeResend)).status, 401);
    assert.equal((await verify(resendTicketEmail, afterResend)).status, 201);
    assert.equal((await call('/email-otp/resend', { loginTicket: afterResend.data.loginTicket })).status, 401);
    const changedEmail = email(), beforeChange = await requestCode(changedEmail);
    await repo.update({ email: changedEmail }, { passwordHash: 'changed-hash-for-test' });
    assert.equal((await verify(changedEmail, beforeChange)).status, 401);
    const { JwtService } = require('@nestjs/jwt'); const jwt = new JwtService();
    const expiredClaims = jwt.decode(beforeChange.data.loginTicket);
    const expiredTicket = jwt.sign({ ...expiredClaims, exp: Math.floor(Date.now()/1000)-1 }, { secret: process.env.EMAIL_OTP_SECRET });
    assert.equal((await call('/email-otp/verify', { loginTicket: expiredTicket, code: '123456' })).status, 401);
    process.env.EMAIL_OTP_DAILY_LIMIT = '1';
    assert.equal((await requestCode(email())).status, 429);
    console.log('PASS: real DB/HTTP email normalization, validation, one-use OTP, hashed storage, expiry, retry/attempt/hour/day quotas, resend invalidation, delivery failure, concurrent send/verify, password-first challenge, no session before OTP, blocked passwordless API, refresh, preserved customer/merchant/admin identity and points. Brevo mocked; no email sent.');
  } finally {
    if (app) {
      const repo = app.get(DataSource).getRepository(User);
      for (const id of new Set(ids)) await repo.delete(id);
      await app.close();
    }
    if (db.isInitialized) await db.destroy();
    await rootDb.query(`DROP SCHEMA "${schema}" CASCADE`); await rootDb.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
