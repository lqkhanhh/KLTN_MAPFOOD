import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UnavailablePaymentProvider } from './providers/unavailable.provider';
import {
  PaymentProvider,
} from '../database/entities';
import {
  PAYMENT_PROVIDER_ADAPTER,
  VnpayProvider,
} from './providers';

@Module({
  imports: [AuthModule, OrdersModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('PAYMENT_PROVIDER', PaymentProvider.VNPAY).toUpperCase();
        if (provider === PaymentProvider.VNPAY) return new VnpayProvider(config);
        if (provider === PaymentProvider.VIETQR || provider === PaymentProvider.PAYOS) return new UnavailablePaymentProvider(provider);
        throw new Error('PAYMENT_PROVIDER must be VNPAY');
      },
    },
  ],
})
export class PaymentsModule {}
