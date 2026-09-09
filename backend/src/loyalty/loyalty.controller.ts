import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { LoyaltyService } from './loyalty.service';

class CreateVoucherDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z0-9_-]{3,40}$/) code: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(160) title: string;
  @IsIn(['percent', 'fixed']) discountType: 'percent' | 'fixed';
  @IsInt() @Min(1) @Max(1_000_000_000) discountValue: number;
  @IsInt() @Min(0) @Max(99_999_999_999_999) minOrderAmount: number;
}
class ActiveVoucherDto { @IsBoolean() active: boolean; }
type RequestUser = { user: AuthenticatedUser };

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly loyalty: LoyaltyService) {}
  @Get('me') points(@Req() req: RequestUser) { return this.loyalty.points(req.user.sub); }
}

@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly loyalty: LoyaltyService) {}
  @Get('available') available(@Req() req: RequestUser) { return this.loyalty.available(req.user.sub); }
  @Get('my-vouchers') mine(@Req() req: RequestUser) { return this.loyalty.mine(req.user.sub); }
  @Post(':id/redeem') redeem(@Req() req: RequestUser, @Param('id', ParseUUIDPipe) id: string) { return this.loyalty.obtain(req.user.sub, id, false); }
  @Post(':id/claim') claim(@Req() req: RequestUser, @Param('id', ParseUUIDPipe) id: string) { return this.loyalty.obtain(req.user.sub, id, true); }
}

// Service kiểm tra quyền hiện tại trong DB, không chỉ tin role cũ trong JWT.
@Controller('admin/vouchers')
@UseGuards(JwtAuthGuard)
export class AdminVouchersController {
  constructor(private readonly loyalty: LoyaltyService) {}
  @Get() list(@Req() req: RequestUser) { return this.loyalty.adminList(req.user.sub); }
  @Post() create(@Req() req: RequestUser, @Body() dto: CreateVoucherDto) { return this.loyalty.adminCreate(req.user.sub, dto); }
  @Patch(':id') active(@Req() req: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActiveVoucherDto) { return this.loyalty.adminSetActive(req.user.sub, id, dto.active); }
}
