import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentWebhookDto {
  @ApiPropertyOptional({ description: 'payOS response code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ type: Object, description: 'Signed payOS data object' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({ description: 'Provider signature/checksum' })
  @IsString()
  signature: string;

  @ApiPropertyOptional({ description: 'VietQR mock transaction ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Business order code for VietQR mock' })
  @IsOptional()
  @IsString()
  orderCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
