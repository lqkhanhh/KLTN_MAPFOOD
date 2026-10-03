import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class EmailOtpRequestDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class EmailOtpVerifyDto extends EmailOtpRequestDto {
  @IsUUID('4')
  challengeId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone?: string;

}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class LoginTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  loginTicket: string;
}

export class VerifyLoginOtpDto extends LoginTicketDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class RegistrationTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  registrationTicket: string;
}

export class VerifyRegistrationOtpDto extends RegistrationTicketDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class FirebaseLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  idToken: string;
}

export class FirebaseLinkDto extends FirebaseLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}
