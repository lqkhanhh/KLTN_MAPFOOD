import { ServiceUnavailableException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { IdentityRateGuard } from './guards/identity-rate.guard';
import { getAuth } from 'firebase-admin/auth';

jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({})), applicationDefault: jest.fn(() => ({})) }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Firebase identity verification', () => {
  const service = new FirebaseService();
  const verify = jest.fn();
  const previous = { ...process.env };
  beforeEach(() => {
    process.env = { ...previous, FIREBASE_PROJECT_ID: 'test-project', FIREBASE_WEB_API_KEY: 'public', FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com', FIREBASE_WEB_APP_ID: 'app', AUTH_GOOGLE_ENABLED: 'true', AUTH_APPLE_ENABLED: 'true', AUTH_PHONE_ENABLED: 'true' };
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken: verify });
    verify.mockResolvedValue({ uid: 'uid', email: 'user@example.com', email_verified: true, auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: 'google.com' } });
  });
  afterAll(() => { process.env = previous; });
  it('verifies the signature/project through Admin SDK and checks revocation', async () => {
    expect((await service.verify('signed-token')).uid).toBe('uid');
    expect(verify).toHaveBeenCalledWith('signed-token', true);
  });
  it.each(['auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/argument-error'])('rejects SDK verification failure: %s', async code => {
    verify.mockRejectedValueOnce({ code });
    await expect(service.verify('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('disables methods when configuration is absent and never discloses credentials', async () => {
    process.env.FIREBASE_PROJECT_ID = '';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'private-service-account.json';
    expect(service.configuration()).toEqual({ config: null, providers: { google: false, apple: false, phone: false } });
    await expect(service.verify('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(verify).not.toHaveBeenCalled();
  });
  it('rejects emulator authentication', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    await expect(service.verify('unsigned-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each([
    { firebase: { sign_in_provider: 'password' } },
    { email_verified: false },
    { auth_time: 1 },
    { firebase: { sign_in_provider: 'phone' }, phone_number: '0901234567' },
  ])('rejects unsupported, unverified or stale identity %j', async overrides => {
    verify.mockResolvedValueOnce({ uid: 'uid', email: 'user@example.com', email_verified: true, auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: 'google.com' }, ...overrides });
    await expect(service.verify('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('accepts Apple verified email and phone without email', async () => {
    verify.mockResolvedValueOnce({ uid: 'apple', email: 'relay@privaterelay.appleid.com', email_verified: true, auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: 'apple.com' } });
    expect((await service.verify('apple-token')).uid).toBe('apple');
    verify.mockResolvedValueOnce({ uid: 'phone', phone_number: '+84901234567', auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: 'phone' } });
    expect((await service.verify('phone-token')).uid).toBe('phone');
  });
  it('honors per-provider switch even for a valid token', async () => {
    process.env.AUTH_GOOGLE_ENABLED = 'false';
    await expect(service.verify('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('allows a 90-second issuer clock difference but rejects more than two minutes', async () => {
    const claims = { uid: 'uid', email: 'user@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
    verify.mockResolvedValueOnce({ ...claims, auth_time: Math.floor(Date.now() / 1000) + 90 });
    expect((await service.verify('verified-token')).uid).toBe('uid');
    verify.mockResolvedValueOnce({ ...claims, auth_time: Math.floor(Date.now() / 1000) + 180 });
    await expect(service.verify('verified-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('limits exchange/link attempts and releases the bucket after a minute', () => {
    const guard = new IdentityRateGuard();
    const context = { switchToHttp: () => ({ getRequest: () => ({ ip: 'test' }) }) } as ExecutionContext;
    for (let i = 0; i < 20; i++) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow('Bạn đã thử quá nhiều lần');
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    expect(guard.canActivate(context)).toBe(true); clock.mockRestore();
  });
});
