import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto); }
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
