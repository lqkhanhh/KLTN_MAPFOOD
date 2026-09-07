import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PublicRestaurantsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class MenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)?$/, { message: 'imageUrl phải là URL HTTP/HTTPS hoặc đường dẫn ảnh nội bộ' })
  imageUrl?: string | null;

  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsInt()
  @Min(0)
  @Max(99_999_999_999_999)
  price: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class RestaurantDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)?$/, { message: 'imageUrl phải là URL HTTP/HTTPS hoặc đường dẫn ảnh nội bộ' })
  imageUrl?: string | null;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsString()
  openingHours: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  menuItems?: MenuItemDto[];
}
