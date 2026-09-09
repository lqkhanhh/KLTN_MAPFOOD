import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { SearchModule } from './search/search.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminModule } from './admin/admin.module';
import { entities } from './database/entities';
import { NotificationsModule } from './notifications/notifications.module';
import { MerchantApplicationsModule } from './merchant-applications/merchant-applications.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MessagesModule } from './messages/messages.module';
import { SupportModule } from './support/support.module';

@Module({ imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      type: 'postgres',
      url: config.get<string>('DATABASE_URL'),
      entities,
      migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
      synchronize:
        config.get<string>('NODE_ENV') !== 'production' &&
        config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
      migrationsRun: config.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true',
      autoLoadEntities: true,
    }),
  }),
  AuthModule, RestaurantsModule, SearchModule, OrdersModule, PaymentsModule, ReviewsModule, AdminModule, NotificationsModule, MerchantApplicationsModule, FavoritesModule, MessagesModule, SupportModule,
] })
export class AppModule {}
