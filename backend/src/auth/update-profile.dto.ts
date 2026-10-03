import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
export class UpdateProfileDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 120) fullName: string;
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s.-]/g, '') : value)
  @IsString()
  @Matches(/^(?:0|\+84)[35789]\d{8}$/, { message: 'Số điện thoại di động Việt Nam không hợp lệ' })
  phone: string;
}
