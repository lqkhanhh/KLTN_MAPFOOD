import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isEmail } from 'class-validator';

@Injectable()
export class BrevoService {
  enabled() {
    return process.env.AUTH_EMAIL_OTP_ENABLED === 'true' && Boolean(process.env.BREVO_API_KEY?.trim())
      && isEmail(process.env.BREVO_SENDER_EMAIL || '') && (process.env.EMAIL_OTP_SECRET?.length || 0) >= 32;
  }

  async sendCode(email: string, code: string) {
    if (!this.enabled()) throw new ServiceUnavailableException('Đăng nhập bằng OTP email chưa được cấu hình.');
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'RouteBite' },
          to: [{ email }], subject: 'Mã xác minh RouteBite',
          textContent: `Mã xác minh RouteBite của bạn là: ${code}\nMã có hiệu lực trong 5 phút và chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.\nNếu bạn không yêu cầu đăng ký hoặc đăng nhập, hãy bỏ qua email này.`,
          tags: ['routebite-login-otp'],
        }),
      });
      if (!response.ok) throw new Error('Mail rejected');
      const data = await response.json() as { messageId?: string };
      if (!data.messageId) throw new Error('Missing delivery acceptance');
    } catch {
      // Never log provider request, secret, recipient or OTP.
      throw new ServiceUnavailableException('Chưa gửi được email xác minh. Vui lòng thử lại sau hoặc dùng tài khoản Google đã liên kết.');
    }
  }
}
