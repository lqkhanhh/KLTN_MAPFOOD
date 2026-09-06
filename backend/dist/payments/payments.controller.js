"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const dto_1 = require("./dto");
const payments_service_1 = require("./payments.service");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    create(dto, user) {
        return this.paymentsService.create(dto.orderId, user);
    }
    webhook(dto) {
        return this.paymentsService.webhook(dto);
    }
    vnpayReturn(query) {
        return this.paymentsService.webhook(query);
    }
    vnpayIpn(payload) {
        return this.paymentsService.webhook(payload);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Tạo hoặc lấy lại giao dịch hiện hành của đơn' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Thông tin checkout/QR lấy từ provider đã cấu hình' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'Đơn đã thanh toán, đã hủy hoặc không cần thanh toán' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreatePaymentDto, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Webhook công khai, bảo vệ bằng chữ ký provider' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Provider callback đã được xác nhận' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Sai chữ ký hoặc dữ liệu không khớp giao dịch' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PaymentWebhookDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "webhook", null);
__decorate([
    (0, common_1.Get)('vnpay-return'),
    (0, swagger_1.ApiOperation)({ summary: 'Xác minh kết quả VNPAY trả về trình duyệt' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "vnpayReturn", null);
__decorate([
    (0, common_1.Post)('vnpay-ipn'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'IPN VNPAY, luôn xác minh chữ ký SHA512' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "vnpayIpn", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('payments'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map