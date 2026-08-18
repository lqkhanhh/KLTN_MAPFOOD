import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { SearchModule } from './search/search.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { entities } from './database/entities';

@Module({ imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ type: 'postgres', url: c.get('DATABASE_URL'), entities, synchronize: true, autoLoadEntities: true }) }),
  AuthModule, RestaurantsModule, SearchModule, OrdersModule, PaymentsModule, ReviewsModule,
] })
export class AppModule {}
