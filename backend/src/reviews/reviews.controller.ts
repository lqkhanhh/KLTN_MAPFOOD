import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities';
import { CreateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Đánh giá một đơn đã hoàn tất' })
  @ApiCreatedResponse({ description: 'Đánh giá đã được tạo' })
  @ApiForbiddenResponse({ description: 'Không phải chủ sở hữu đơn' })
  @ApiConflictResponse({ description: 'Đơn chưa hoàn tất hoặc đã được đánh giá' })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.create(dto, user.sub);
  }

  @Delete(':id') @UseGuards(RolesGuard) @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.reviewsService.removeByAdmin(id); }
}
