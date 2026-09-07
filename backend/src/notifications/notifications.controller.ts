import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) { return this.notifications.findAllForUser(user.sub); }
  @Patch('read-all')
  markAll(@CurrentUser() user: AuthenticatedUser) { return this.notifications.markAllAsRead(user.sub); }
  @Patch(':id/read')
  markOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.notifications.markAsRead(id, user.sub); }
}
