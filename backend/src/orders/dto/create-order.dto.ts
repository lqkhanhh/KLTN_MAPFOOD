import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderPaymentMethod, PickupType } from '../../database/entities';

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class PickupOptionDto {
  @ApiProperty({ enum: PickupType })
  @IsEnum(PickupType)
  type: PickupType;

  @ApiPropertyOptional({ minimum: 1, description: 'Phút chuẩn bị do dữ liệu lộ trình gợi ý' })
  @ValidateIf((dto: PickupOptionDto) => dto.type === PickupType.ASAP)
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedPickupMinutes?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Bắt buộc khi hẹn giờ lấy món' })
  @ValidateIf((dto: PickupOptionDto) => dto.type === PickupType.SCHEDULED)
  @IsISO8601()
  scheduledTime?: string;
}

export class PaymentOptionDto {
  @ApiProperty({ enum: OrderPaymentMethod })
  @IsEnum(OrderPaymentMethod)
  method: OrderPaymentMethod;
}

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  restaurantId: string;

  @ApiProperty({ type: PickupOptionDto })
  @ValidateNested()
  @Type(() => PickupOptionDto)
  pickupOption: PickupOptionDto;

  @ApiProperty({ type: PaymentOptionDto })
  @ValidateNested()
  @Type(() => PaymentOptionDto)
  payment: PaymentOptionDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: CreateOrderItemDto) => item.menuItemId)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
