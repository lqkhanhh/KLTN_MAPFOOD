import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../database/entities/user.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone?: string;

  @IsIn([UserRole.CUSTOMER, UserRole.MERCHANT])
  role: UserRole = UserRole.CUSTOMER;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
