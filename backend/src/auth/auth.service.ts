import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { LoginDto, RegisterDto } from './dto';

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
        role: dto.role,
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
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.users.save(user);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}
