import { ServiceUnavailableException } from '@nestjs/common';
import { BrevoService } from './brevo.service';

describe('Brevo transactional OTP email', () => {
  const service = new BrevoService(), original = { ...process.env };
  let send: jest.SpyInstance;
  beforeEach(() => {
    process.env = { ...original, AUTH_EMAIL_OTP_ENABLED: 'true', BREVO_API_KEY: 'test-api-key', BREVO_SENDER_EMAIL: 'sender@example.com', EMAIL_OTP_SECRET: 'x'.repeat(64) };
    send = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: 'test' }), { status: 201 }));
  });
  afterEach(() => { send.mockRestore(); process.env = original; });
  it('sends OTP using the transactional API without including credentials in content', async () => {
    await service.sendCode('recipient@example.com', '012345');
    expect(send.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
    const options = send.mock.calls[0][1];
    expect(options.headers['api-key']).toBe('test-api-key');
    const body = JSON.parse(options.body);
    expect(body.to).toEqual([{ email: 'recipient@example.com' }]);
    expect(body.textContent).toContain('012345');
    expect(body.textContent).not.toContain('test-api-key');
    expect(options.signal).toBeDefined();
  });
  it.each(['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'EMAIL_OTP_SECRET'])('requires %s and sends no email without it', async name => {
    process.env[name] = '';
    expect(service.enabled()).toBe(false);
    await expect(service.sendCode('recipient@example.com', '123456')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(send).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])('handles provider status %s without exposing response', async status => {
    send.mockResolvedValue(new Response('private provider diagnostic', { status }));
    await expect(service.sendCode('recipient@example.com', '123456')).rejects.toThrow('Chưa gửi được email');
  });
  it('handles network timeout and incomplete success responses', async () => {
    send.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.sendCode('recipient@example.com', '123456')).rejects.toBeInstanceOf(ServiceUnavailableException);
    send.mockResolvedValueOnce(new Response('{}', { status: 201 }));
    await expect(service.sendCode('recipient@example.com', '123456')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
