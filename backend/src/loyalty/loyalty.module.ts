import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PointsTransaction, UserVoucher, Voucher } from './loyalty.entity';
import { LoyaltyService } from './loyalty.service';
import { AdminVouchersController, PointsController, VouchersController } from './loyalty.controller';

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Voucher, UserVoucher, PointsTransaction])],
  providers: [LoyaltyService], controllers: [PointsController, VouchersController, AdminVouchersController], exports: [LoyaltyService] })
export class LoyaltyModule {}
