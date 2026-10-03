import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto';
import { UpdateProfileDto } from './update-profile.dto';
import { FirebaseService } from './firebase.service';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EmailOtpService } from './email-otp.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly firebase: FirebaseService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  providers() { return this.firebase.configuration(); }

  async identityStatus(userId: string) {
    const user = await this.users.createQueryBuilder('user').addSelect('user.firebaseUid').where('user.id = :userId', { userId }).getOne();
    if (!user) throw new UnauthorizedException();
    return { linked: Boolean(user.firebaseUid), hasPassword: Boolean(user.passwordHash) };
  }

  async firebaseLogin(idToken: string) {
    const identity = await this.firebase.verify(idToken);
    let user = await this.users.findOneBy({ firebaseUid: identity.uid });
    if (!user) {
      // Editable contact phone is deliberately never used to resolve an identity.
      const email = identity.email_verified && identity.email
        ? identity.email.toLowerCase().trim()
        : `${createHash('sha256').update(identity.uid).digest('hex')}@identity.routebite.invalid`;
      if (await this.users.findOneBy({ email })) {
        throw new ConflictException('Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu, vào Hồ sơ và liên kết phương thức đăng nhập.');
      }
      try {
        user = await this.users.save(this.users.create({
          firebaseUid: identity.uid, email, passwordHash: '', role: UserRole.CUSTOMER,
          fullName: (typeof identity.name === 'string' && identity.name.trim() ? identity.name.trim() : 'Khách hàng').slice(0, 120),
          phone: identity.firebase.sign_in_provider === 'phone' ? identity.phone_number : undefined,
        }));
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
        // A simultaneous first login may already have created this exact identity.
        user = await this.users.findOneBy({ firebaseUid: identity.uid });
        if (!user) throw new ConflictException('Email đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu để liên kết.');
      }
    }
    return this.tokens(user);
  }

  async linkFirebase(userId: string, idToken: string, password: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
    }
    const identity = await this.firebase.verify(idToken);
    const owner = await this.users.findOneBy({ firebaseUid: identity.uid });
    if (owner && owner.id !== userId) throw new ConflictException('Danh tính này đã thuộc tài khoản khác. Không thể tự động gộp tài khoản.');
    try {
      const result = await this.users.createQueryBuilder().update(User).set({ firebaseUid: identity.uid })
        .where('id = :userId AND ("firebaseUid" IS NULL OR "firebaseUid" = :uid) AND "passwordHash" = :hash', { userId, uid: identity.uid, hash: user.passwordHash }).execute();
      if (result.affected !== 1) throw new ConflictException('Tài khoản đã liên kết danh tính khác hoặc mật khẩu vừa thay đổi.');
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Danh tính này đã thuộc tài khoản khác.');
      throw error;
    }
    return { message: 'Đã liên kết. Bạn có thể dùng phương thức này để đăng nhập vào tài khoản hiện tại.' };
  }

  async profile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, email: true, fullName: true, phone: true, role: true, pointsBalance: true } });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return user;
  }
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const result = await this.users.update(userId, { fullName: dto.fullName, phone: dto.phone });
    if (result.affected !== 1) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return this.profile(userId);
  }
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findOneBy({ email })) {
      throw new ConflictException('Email đã tồn tại');
    }
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('Mật khẩu vượt giới hạn 72 byte.');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const challenge = await this.emailOtp.send(email);
    return this.registrationChallenge({ email, fullName: dto.fullName.trim(), phone: dto.phone, passwordHash }, challenge);
  }

  private registrationKey() {
    return createHash('sha256').update(`routebite-registration-v1:${process.env.EMAIL_OTP_SECRET}`).digest();
  }

  private registrationChallenge(profile: { email: string; fullName: string; phone?: string; passwordHash: string }, challenge: { challengeId: string; expiresIn: number; retryAfter: number; message: string }) {
    // Encrypt pending data: a readable JWT must never expose the password hash.
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.registrationKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ email: profile.email, fullName: profile.fullName, phone: profile.phone, passwordHash: profile.passwordHash, purpose: 'register', challengeId: challenge.challengeId, expiresAt: Date.now() + 300000 }), 'utf8'), cipher.final()]);
    const registrationTicket = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    return { requiresOtp: true, registrationTicket, expiresIn: challenge.expiresIn, retryAfter: challenge.retryAfter, message: challenge.message };
  }

  private pendingRegistration(ticket: string) {
    try {
      const bytes = Buffer.from(ticket, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.registrationKey(), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const pending = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as {
        email: string; fullName: string; phone?: string; passwordHash: string; purpose: string; challengeId: string; expiresAt: number;
      };
      if (pending.purpose !== 'register' || !pending.challengeId || pending.expiresAt <= Date.now()) throw new Error();
      return pending;
    } catch { throw new UnauthorizedException('Phiên đăng ký không hợp lệ hoặc đã hết hạn. Vui lòng nhập lại thông tin.'); }
  }

  async resendRegistrationOtp(ticket: string) {
    const pending = this.pendingRegistration(ticket);
    if (await this.users.findOneBy({ email: pending.email })) throw new ConflictException('Email đã tồn tại. Vui lòng đăng nhập.');
    const challenge = await this.emailOtp.send(pending.email, pending.challengeId);
    return this.registrationChallenge(pending, challenge);
  }

  async verifyRegistrationOtp(ticket: string, code: string) {
    const pending = this.pendingRegistration(ticket);
    await this.emailOtp.consume(pending.email, pending.challengeId, code);
    let user: User;
    try {
      user = await this.users.save(this.users.create({
        email: pending.email, fullName: pending.fullName, phone: pending.phone,
        passwordHash: pending.passwordHash, role: UserRole.CUSTOMER,
      }));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Email đã tồn tại. Vui lòng đăng nhập.');
      throw error;
    }
    return this.tokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOneBy({ email: dto.email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.loginChallenge(user);
  }

  private async loginChallenge(user: User, previousChallengeId?: string) {
    const challenge = await this.emailOtp.send(user.email, previousChallengeId);
    const loginTicket = this.jwtService.sign({
      sub: user.id, purpose: 'password-login-otp', challengeId: challenge.challengeId,
      passwordVersion: createHash('sha256').update(user.passwordHash).digest('hex'),
    }, { secret: process.env.EMAIL_OTP_SECRET, expiresIn: '5m' });
    return { requiresOtp: true, loginTicket, expiresIn: challenge.expiresIn, retryAfter: challenge.retryAfter, message: challenge.message };
  }

  private async pendingLogin(loginTicket: string) {
    try {
      const claims = this.jwtService.verify<{ sub: string; purpose: string; challengeId: string; passwordVersion: string }>(loginTicket, { secret: process.env.EMAIL_OTP_SECRET, algorithms: ['HS256'] });
      if (claims.purpose !== 'password-login-otp' || !claims.challengeId) throw new Error();
      const user = await this.users.findOneBy({ id: claims.sub });
      if (!user?.passwordHash || createHash('sha256').update(user.passwordHash).digest('hex') !== claims.passwordVersion) throw new Error();
      return { user, challengeId: claims.challengeId };
    } catch { throw new UnauthorizedException('Phiên xác minh đã hết hạn. Vui lòng nhập lại email và mật khẩu.'); }
  }

  async verifyLoginOtp(loginTicket: string, code: string) {
    const { user, challengeId } = await this.pendingLogin(loginTicket);
    await this.emailOtp.consume(user.email, challengeId, code);
    return this.tokens(user);
  }

  async resendLoginOtp(loginTicket: string) {
    const { user, challengeId } = await this.pendingLogin(loginTicket);
    return this.loginChallenge(user, challengeId);
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
