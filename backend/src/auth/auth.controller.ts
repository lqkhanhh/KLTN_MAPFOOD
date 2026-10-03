import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UpdateProfileDto } from './update-profile.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, FirebaseLinkDto, FirebaseLoginDto, LoginDto, RefreshDto, RegisterDto, RegistrationTicketDto, VerifyRegistrationOtpDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { IdentityRateGuard } from './guards/identity-rate.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('providers') providers() { return this.service.providers(); }

  @Post('firebase') @UseGuards(IdentityRateGuard) firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.service.firebaseLogin(dto.idToken);
  }

  @Get('firebase/status') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
  identityStatus(@CurrentUser() user: AuthenticatedUser) { return this.service.identityStatus(user.sub); }

  @Post('firebase/link') @ApiBearerAuth() @UseGuards(JwtAuthGuard, IdentityRateGuard)
  linkFirebase(@CurrentUser() user: AuthenticatedUser, @Body() dto: FirebaseLinkDto) {
    return this.service.linkFirebase(user.sub, dto.idToken, dto.password);
  }
  constructor(private service: AuthService) {}
  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthenticatedUser) { return this.service.profile(user.sub); }
  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) { return this.service.updateProfile(user.sub, dto); }
  @Post('register') @UseGuards(IdentityRateGuard) register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Post('register/verify') @UseGuards(IdentityRateGuard)
  verifyRegistration(@Body() dto: VerifyRegistrationOtpDto) { return this.service.verifyRegistrationOtp(dto.registrationTicket, dto.code); }
  @Post('register/resend') @UseGuards(IdentityRateGuard)
  resendRegistration(@Body() dto: RegistrationTicketDto) { return this.service.resendRegistrationOtp(dto.registrationTicket); }
  @Post('login') @UseGuards(IdentityRateGuard) login(@Body() dto: LoginDto) { return this.service.login(dto); }
  @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken); }
  @Patch('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.sub, dto);
  }
  @Post('upgrade-to-merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upgradeToMerchant(@CurrentUser() user: AuthenticatedUser) { return this.service.upgradeToMerchant(user.sub); }
}
