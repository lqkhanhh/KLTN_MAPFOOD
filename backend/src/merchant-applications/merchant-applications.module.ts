import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantApplicationsController, AdminMerchantApplicationsController } from './merchant-applications.controller';
import { MerchantApplicationsService } from './merchant-applications.service';
@Module({ imports: [AuthModule], controllers: [MerchantApplicationsController, AdminMerchantApplicationsController], providers: [MerchantApplicationsService] })
export class MerchantApplicationsModule {}
