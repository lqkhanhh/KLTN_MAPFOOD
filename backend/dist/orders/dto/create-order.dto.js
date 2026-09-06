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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrderDto = exports.PaymentOptionDto = exports.PickupOptionDto = exports.CreateOrderItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const entities_1 = require("../../database/entities");
class CreateOrderItemDto {
}
exports.CreateOrderItemDto = CreateOrderItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "menuItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 100 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "note", void 0);
class PickupOptionDto {
}
exports.PickupOptionDto = PickupOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: entities_1.PickupType }),
    (0, class_validator_1.IsEnum)(entities_1.PickupType),
    __metadata("design:type", String)
], PickupOptionDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, description: 'Phút chuẩn bị do dữ liệu lộ trình gợi ý' }),
    (0, class_validator_1.ValidateIf)((dto) => dto.type === entities_1.PickupType.ASAP),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(720),
    __metadata("design:type", Number)
], PickupOptionDto.prototype, "estimatedPickupMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', description: 'Bắt buộc khi hẹn giờ lấy món' }),
    (0, class_validator_1.ValidateIf)((dto) => dto.type === entities_1.PickupType.SCHEDULED),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], PickupOptionDto.prototype, "scheduledTime", void 0);
class PaymentOptionDto {
}
exports.PaymentOptionDto = PaymentOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: entities_1.OrderPaymentMethod }),
    (0, class_validator_1.IsEnum)(entities_1.OrderPaymentMethod),
    __metadata("design:type", String)
], PaymentOptionDto.prototype, "method", void 0);
class CreateOrderDto {
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "restaurantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PickupOptionDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PickupOptionDto),
    __metadata("design:type", PickupOptionDto)
], CreateOrderDto.prototype, "pickupOption", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PaymentOptionDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PaymentOptionDto),
    __metadata("design:type", PaymentOptionDto)
], CreateOrderDto.prototype, "payment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "note", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CreateOrderItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)((item) => item.menuItemId),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateOrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
//# sourceMappingURL=create-order.dto.js.map