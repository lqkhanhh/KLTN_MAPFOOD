import { Type, Transform } from 'class-transformer';
import { Equals, IsBoolean, IsDefined, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class ShopDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(150) name: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) address: string;
  @IsLatitude() latitude: number;
  @IsLongitude() longitude: number;
  @IsIn(['com', 'bun-pho', 'ca-phe', 'do-uong', 'an-vat', 'khac']) category: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(100) openingHours: string;
}
export class SaveApplicationDto { @IsDefined() @ValidateNested() @Type(() => ShopDto) shop: ShopDto }
export class BankDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) bankName: string;
  @Transform(trim) @IsString() @Matches(/^[0-9]{6,30}$/) accountNumber: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) accountHolder: string;
}
export class AgreementsDto {
  @IsBoolean() @Equals(true) accuracy: boolean;
  @IsBoolean() @Equals(true) terms: boolean;
  @IsBoolean() @Equals(true) documentReview: boolean;
}
export class SubmitApplicationDto {
  @IsString() @MaxLength(80) termsVersion: string;
  @IsDefined() @ValidateNested() @Type(() => AgreementsDto) agreements: AgreementsDto;
}
export class RejectApplicationDto { @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) reason: string }
export class ApplicationQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']) status?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
