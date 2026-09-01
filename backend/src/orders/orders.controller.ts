import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UserRole } from '../database/entities';
import { CreateOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo đơn đặt bàn hoặc mang đi' })
  @ApiCreatedResponse({ description: 'Đơn được tạo từ giá menu hiện tại' })
  @ApiConflictResponse({ description: 'Quán ngừng hoạt động hoặc dữ liệu đã thay đổi' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn theo quyền người dùng và bộ lọc' })
  @ApiOkResponse({ description: 'Danh sách đơn hàng' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAllForUser(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn, món, thanh toán và đánh giá' })
  @ApiOkResponse({ description: 'Chi tiết đơn hàng' })
  @ApiForbiddenResponse({ description: 'Không sở hữu đơn hoặc quán' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy đơn' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findOneForUser(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Merchant cập nhật trạng thái xử lý đơn' })
  @ApiOkResponse({ description: 'Đơn sau khi chuyển trạng thái' })
  @ApiConflictResponse({ description: 'Bước chuyển trạng thái không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Merchant không quản lý quán này' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user);
  }
}
