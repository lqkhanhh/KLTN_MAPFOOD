import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId: string;
}
