import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RouteSearchDto } from './dto/route-search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('route')
  @UseGuards(OptionalJwtAuthGuard)
  route(@Body() dto: RouteSearchDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.searchService.route(dto, user?.sub);
  }

  @Get('route')
  @UseGuards(OptionalJwtAuthGuard)
  routeGet(@Body() dto: RouteSearchDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.searchService.route(dto, user?.sub);
  }
}
