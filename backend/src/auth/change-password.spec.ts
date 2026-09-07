import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto';

describe('Change password', () => {
  const repo = { findOneBy: jest.fn(), update: jest.fn() };
  const service = new AuthService(repo as never, {} as never);
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.findOneBy.mockResolvedValue({ id: 'owner', passwordHash: await bcrypt.hash('old-pass', 4) });
    repo.update.mockResolvedValue({ affected: 1 });
  });
  it('hashes the new password, revokes refresh token, never returns hashes', async () => {
    const result = await service.changePassword('owner', { oldPassword: 'old-pass', newPassword: 'new-pass' });
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'owner' });
    const update = repo.update.mock.calls[0][1];
    expect(await bcrypt.compare('new-pass', update.passwordHash)).toBe(true);
    expect(update.refreshTokenHash).toBe('');
    expect(result).toEqual({ message: 'Đổi mật khẩu thành công!' });
  });
  it('rejects incorrect current password without modifying user', async () => {
    await expect(service.changePassword('owner', { oldPassword: 'wrong', newPassword: 'new-pass' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('rejects missing users and concurrent changes', async () => {
    repo.findOneBy.mockResolvedValueOnce(null);
    await expect(service.changePassword('missing', { oldPassword: 'old-pass', newPassword: 'new-pass' })).rejects.toBeInstanceOf(UnauthorizedException);
    repo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.changePassword('owner', { oldPassword: 'old-pass', newPassword: 'new-pass' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('validates required fields and minimum new password length', async () => {
    expect((await validate(Object.assign(new ChangePasswordDto(), { oldPassword: '', newPassword: '123' })))).toHaveLength(2);
  });
});
