import { BrevoService } from './brevo.service';
import { EmailOtpService } from './email-otp.service';
import { EmailOtpController } from './email-otp.controller';
import { IdentityRateGuard } from './guards/identity-rate.guard';
import { FirebaseService } from './firebase.service';
import { Module } from '@nestjs/common'; import { JwtModule } from '@nestjs/jwt'; import { TypeOrmModule } from '@nestjs/typeorm'; import { User } from '../database/entities/user.entity'; import { AuthService } from './auth.service'; import { AuthController } from './auth.controller'; import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards/jwt-auth.guard'; import { RolesGuard } from './guards/roles.guard';
@Module({ imports: [TypeOrmModule.forFeature([User]), JwtModule.register({})], providers: [BrevoService, EmailOtpService, IdentityRateGuard, FirebaseService, AuthService, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard], controllers: [AuthController, EmailOtpController], exports: [JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard] }) export class AuthModule {}
