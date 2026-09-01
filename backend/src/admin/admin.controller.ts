import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities';
import { AdminService } from './admin.service';
import { AdminRestaurantQueryDto, AdminUserQueryDto, SuspendRestaurantDto } from './dto';

@ApiTags('admin') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN) @Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get('dashboard/overview') overview() { return this.service.overview(); }
  @Get('search-analytics') searchAnalytics() { return this.service.searchAnalytics(); }
  @Get('restaurants') restaurants(@Query() query: AdminRestaurantQueryDto) { return this.service.restaurants(query); }
  @Get('users') users(@Query() query: AdminUserQueryDto) { return this.service.users(query); }
  @Patch('restaurants/:id/suspend') suspend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SuspendRestaurantDto) { return this.service.suspend(id, dto.reason); }
  @Patch('restaurants/:id/activate') activate(@Param('id', ParseUUIDPipe) id: string) { return this.service.activate(id); }
}
