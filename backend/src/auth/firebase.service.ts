import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  configuration() {
    const config = {
      apiKey: process.env.FIREBASE_WEB_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      appId: process.env.FIREBASE_WEB_APP_ID || '',
    };
    const ready = Object.values(config).every(Boolean);
    return {
      config: ready ? config : null,
      providers: {
        google: ready && process.env.AUTH_GOOGLE_ENABLED === 'true',
        apple: ready && process.env.AUTH_APPLE_ENABLED === 'true',
        phone: ready && process.env.AUTH_PHONE_ENABLED === 'true',
      },
    };
  }

  async verify(idToken: string): Promise<DecodedIdToken> {
    const { config, providers } = this.configuration();
    if (!config || !Object.values(providers).some(Boolean)) {
      throw new ServiceUnavailableException('Đăng nhập Google, Apple và OTP chưa được cấu hình.');
    }
    // Never accept unsigned emulator tokens on the application server.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new ServiceUnavailableException('Máy chủ không hỗ trợ token giả lập Firebase.');
    }
    try {
      const app = getApps().find(item => item.name === 'routebite-auth') || initializeApp({
        projectId: config.projectId, credential: applicationDefault(),
      }, 'routebite-auth');
      const token = await getAuth(app).verifyIdToken(idToken, true);
      const provider = token.firebase?.sign_in_provider;
      const enabled = { 'google.com': providers.google, 'apple.com': providers.apple, phone: providers.phone };
      if (!enabled[provider as keyof typeof enabled]) throw new Error('Provider disabled');
      // Allow small clock differences between this host and Google's issuer.
      const now = Date.now() / 1000;
      if (!token.auth_time || now - token.auth_time > 300 || token.auth_time > now + 120) throw new Error('Recent sign-in required');
      if (provider === 'phone') {
        if (!/^\+[1-9]\d{7,14}$/.test(token.phone_number || '')) throw new Error('Missing verified phone');
      } else if (!token.email || token.email_verified !== true) throw new Error('Verified email required');
      return token;
    } catch (error) {
      const code = (error as { code?: string }).code;
      const reason = error instanceof Error ? error.message : '';
      const safeReasons = ['Provider disabled', 'Recent sign-in required', 'Missing verified phone', 'Verified email required'];
      this.logger.warn(`Identity verification failed: ${typeof code === 'string' && /^[a-zA-Z0-9/_-]{1,80}$/.test(code) ? code : safeReasons.includes(reason) ? reason : 'unknown'}`);
      throw new UnauthorizedException('Không xác minh được danh tính. Vui lòng đăng nhập lại với nhà cung cấp.');
    }
  }
}
