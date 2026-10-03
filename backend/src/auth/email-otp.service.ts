import { HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { BrevoService } from './brevo.service';

interface Challenge {
  email: string; challengeId: string; codeHash: string; expiresAt: Date;
  sentAt: Date; windowStart: Date; sendCount: number; attempts: number; consumed: boolean; delivered: boolean;
}

@Injectable()
export class EmailOtpService {
  constructor(private readonly db: DataSource, private readonly brevo: BrevoService) {}
  enabled() { return this.brevo.enabled(); }
  private requireEnabled() {
    if (!this.enabled()) throw new ServiceUnavailableException('Đăng nhập bằng OTP email chưa được cấu hình.');
  }
  private digest(email: string, id: string, code: string) {
    return createHmac('sha256', process.env.EMAIL_OTP_SECRET!).update(`${email}\n${id}\n${code}`).digest('hex');
  }
  async send(rawEmail: string, previousChallengeId?: string) {
    this.requireEnabled();
    const email = rawEmail.toLowerCase().trim();
    const id = randomUUID(), code = randomInt(0, 1000000).toString().padStart(6, '0');
    const hash = this.digest(email, id, code);
    await this.db.transaction(async manager => {
      // Global transaction lock coordinates reservations across all backend processes.
      await manager.query('SELECT pg_advisory_xact_lock(1789300000)');
      const [row]: Challenge[] = await manager.query('SELECT * FROM auth_email_otps WHERE email = $1 FOR UPDATE', [email]);
      const now = Date.now();
      if (previousChallengeId && (!row || row.challengeId !== previousChallengeId || row.consumed || !row.delivered || new Date(row.expiresAt).getTime() <= now)) {
        throw new UnauthorizedException('Phiên xác minh không còn hiệu lực. Vui lòng đăng nhập lại.');
      }
      if (row && (now - new Date(row.sentAt).getTime() < 60000 ||
          (now - new Date(row.windowStart).getTime() < 3600000 && row.sendCount >= 5))) {
        throw new HttpException('Vui lòng chờ trước khi gửi lại. Mỗi email được nhận tối đa 5 mã trong một giờ, cách nhau ít nhất 60 giây.', HttpStatus.TOO_MANY_REQUESTS);
      }
      const configuredLimit = Number(process.env.EMAIL_OTP_DAILY_LIMIT || 250);
      const dailyLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 250;
      const budget: { sends: number }[] = await manager.query(`INSERT INTO auth_email_otp_budget (day, sends)
        VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
        ON CONFLICT (day) DO UPDATE SET sends = auth_email_otp_budget.sends + 1
        WHERE auth_email_otp_budget.sends < $1 RETURNING sends`, [dailyLimit]);
      if (!budget.length) throw new HttpException('Đã đạt hạn mức gửi email hôm nay. Vui lòng thử lại sau hoặc dùng tài khoản Google đã liên kết.', HttpStatus.TOO_MANY_REQUESTS);
      await manager.query(`INSERT INTO auth_email_otps (email, "challengeId", "codeHash", "expiresAt")
        VALUES ($1, $2, $3, now() + interval '5 minutes')
        ON CONFLICT (email) DO UPDATE SET "challengeId" = $2, "codeHash" = $3,
          "expiresAt" = now() + interval '5 minutes', "sentAt" = now(),
          "sendCount" = CASE WHEN auth_email_otps."windowStart" <= now() - interval '1 hour' THEN 1 ELSE auth_email_otps."sendCount" + 1 END,
          "windowStart" = CASE WHEN auth_email_otps."windowStart" <= now() - interval '1 hour' THEN now() ELSE auth_email_otps."windowStart" END,
          attempts = 0, consumed = false, delivered = false`, [email, id, hash]);
      await manager.query(`DELETE FROM auth_email_otps WHERE "sentAt" < now() - interval '1 day'`);
      await manager.query(`DELETE FROM auth_email_otp_budget WHERE day < (now() AT TIME ZONE 'UTC')::date - 7`);
    });
    // No database lock is held while calling the mail provider. Failed attempts still count toward quotas.
    try {
      await this.brevo.sendCode(email, code);
      await this.db.query('UPDATE auth_email_otps SET delivered = true WHERE email = $1 AND "challengeId" = $2', [email, id]);
    } catch (error) {
      await this.db.query('UPDATE auth_email_otps SET consumed = true WHERE email = $1 AND "challengeId" = $2', [email, id]);
      throw error;
    }
    return { challengeId: id, expiresIn: 300, retryAfter: 60, message: 'Đã yêu cầu gửi mã xác minh. Vui lòng kiểm tra hộp thư và thư rác.' };
  }

  async consume(rawEmail: string, id: string, code: string) {
    this.requireEnabled();
    const email = rawEmail.toLowerCase().trim();
    const accepted = await this.db.transaction(async manager => {
      const [row]: Challenge[] = await manager.query('SELECT * FROM auth_email_otps WHERE email = $1 FOR UPDATE', [email]);
      if (!row || row.challengeId !== id || row.consumed || !row.delivered || row.attempts >= 5 || new Date(row.expiresAt).getTime() <= Date.now()) return false;
      const valid = timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(this.digest(email, id, code), 'hex'));
      // Return failure instead of throwing inside the transaction, so failed attempts commit.
      await manager.query('UPDATE auth_email_otps SET attempts = attempts + 1, consumed = $2 WHERE email = $1', [email, valid || row.attempts + 1 >= 5]);
      return valid;
    });
    if (!accepted) throw new UnauthorizedException('Mã OTP không đúng, đã hết hạn hoặc đã dùng. Vui lòng kiểm tra lại hoặc gửi mã mới.');
    return email;
  }
}
