import { Type } from 'class-transformer';
import { IsDefined, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
class PointDto { @IsLatitude() latitude: number; @IsLongitude() longitude: number; }
export class RouteSearchDto {
  @IsDefined() @ValidateNested() @Type(() => PointDto) pointA: PointDto;
  @IsDefined() @ValidateNested() @Type(() => PointDto) pointB: PointDto;
  @IsOptional() @IsNumber() @Min(100) @Max(5000) radius = 500;
  @IsOptional() @IsIn(['DRIVE', 'TWO_WHEELER']) travelMode: 'DRIVE' | 'TWO_WHEELER' = 'DRIVE';
}
