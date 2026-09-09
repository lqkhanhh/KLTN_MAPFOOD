import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user.sub); }
  @Post(':restaurantId') add(@CurrentUser() user: AuthenticatedUser, @Param('restaurantId', ParseUUIDPipe) id: string) {
    return this.service.add(user.sub, id);
  }
  @Delete(':restaurantId') remove(@CurrentUser() user: AuthenticatedUser, @Param('restaurantId', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id);
  }
}
