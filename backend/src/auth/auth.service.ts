import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findOneBy({ email: dto.email })) {
      throw new ConflictException('Email đã tồn tại');
    }
    const user = await this.users.save(
      this.users.create({
        email: dto.email.toLowerCase().trim(),
        fullName: dto.fullName.trim(),
        phone: dto.phone,
        // Đăng ký công khai luôn là customer; merchant dùng flow nâng cấp riêng.
        role: UserRole.CUSTOMER,
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    );
    return this.tokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOneBy({ email: dto.email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.tokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const data = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.users.findOneByOrFail({ id: data.sub });
      if (!user.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
        throw new Error('Refresh token mismatch');
      }
      return this.tokens(user);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  async upgradeToMerchant(userId: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) return this.tokens(user);
    throw new ForbiddenException('Vui lòng nộp hồ sơ đăng ký đối tác và chờ Admin phê duyệt.');
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    if (!user.passwordHash || !(await bcrypt.compare(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.oldPassword === dto.newPassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('Mật khẩu mới vượt giới hạn 72 byte');
    // Kiểm tra hash khi ghi để hai yêu cầu đồng thời không ghi đè mật khẩu mới.
    const result = await this.users.update({ id: userId, passwordHash: user.passwordHash }, {
      passwordHash: await bcrypt.hash(dto.newPassword, 10),
      refreshTokenHash: '',
    });
    if (result.affected !== 1) throw new ConflictException('Mật khẩu đã thay đổi. Vui lòng thử lại.');
    return { message: 'Đổi mật khẩu thành công!' };
  }

  private async tokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });
    // Không ghi lại toàn bộ user: tránh đè số dư xu vừa thay đổi ở transaction khác.
    await this.users.update(user.id, { refreshTokenHash: await bcrypt.hash(refreshToken, 10) });
    const balance = await this.users.findOne({ where: { id: user.id }, select: { pointsBalance: true } });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        pointsBalance: balance?.pointsBalance ?? 0,
      },
    };
  }
}
