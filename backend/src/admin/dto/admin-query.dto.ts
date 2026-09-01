import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '../../database/entities';

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class AdminRestaurantQueryDto extends PageQueryDto {
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() active?: boolean;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() search?: string;
}
export class AdminUserQueryDto extends PageQueryDto {
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() search?: string;
}
