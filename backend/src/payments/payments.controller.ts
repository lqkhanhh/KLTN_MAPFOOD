import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreatePaymentDto, PaymentWebhookDto } from './dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo hoặc lấy lại giao dịch hiện hành của đơn' })
  @ApiCreatedResponse({ description: 'Thông tin checkout/QR lấy từ provider đã cấu hình' })
  @ApiConflictResponse({ description: 'Đơn đã thanh toán, đã hủy hoặc không cần thanh toán' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.create(dto.orderId, user);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook công khai, bảo vệ bằng chữ ký provider' })
  @ApiOkResponse({ description: 'Provider callback đã được xác nhận' })
  @ApiBadRequestResponse({ description: 'Sai chữ ký hoặc dữ liệu không khớp giao dịch' })
  webhook(@Body() dto: PaymentWebhookDto) {
    return this.paymentsService.webhook(dto);
  }

  @Get('vnpay-return')
  @ApiOperation({ summary: 'Xác minh kết quả VNPAY trả về trình duyệt' })
  vnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentsService.webhook(query);
  }

  @Post('vnpay-ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IPN VNPAY, luôn xác minh chữ ký SHA512' })
  vnpayIpn(@Body() payload: Record<string, string>) {
    return this.paymentsService.webhook(payload);
  }
}
