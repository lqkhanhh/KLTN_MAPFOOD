import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  PaymentProvider,
} from '../database/entities';
import {
  PAYMENT_PROVIDER_ADAPTER,
  VnpayProvider,
} from './providers';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('PAYMENT_PROVIDER', PaymentProvider.VNPAY).toUpperCase();
        if (provider === PaymentProvider.VNPAY) return new VnpayProvider(config);
        throw new Error('PAYMENT_PROVIDER must be VNPAY');
      },
    },
  ],
})
export class PaymentsModule {}
