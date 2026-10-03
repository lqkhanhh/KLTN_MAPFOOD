import { Body, Controller, Get, GoneException, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmailOtpService } from './email-otp.service';
import { AuthService } from './auth.service';
import { LoginTicketDto, VerifyLoginOtpDto } from './dto';
import { IdentityRateGuard } from './guards/identity-rate.guard';

@ApiTags('auth')
@Controller('auth/email-otp')
export class EmailOtpController {
  constructor(private readonly otp: EmailOtpService, private readonly auth: AuthService) {}
  @Get('status') status() { return { enabled: this.otp.enabled() }; }
  @Post('request') @UseGuards(IdentityRateGuard)
  request() { throw new GoneException('Vui lòng nhập email và mật khẩu để nhận mã xác minh đăng nhập.'); }
  @Post('resend') @UseGuards(IdentityRateGuard)
  resend(@Body() dto: LoginTicketDto) { return this.auth.resendLoginOtp(dto.loginTicket); }
  @Post('verify') @UseGuards(IdentityRateGuard)
  verify(@Body() dto: VerifyLoginOtpDto) { return this.auth.verifyLoginOtp(dto.loginTicket, dto.code); }
}
