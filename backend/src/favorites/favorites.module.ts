import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Restaurant } from '../database/entities/restaurant.entity';
import { Favorite } from './favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Favorite, Restaurant])],
  controllers: [FavoritesController], providers: [FavoritesService] })
export class FavoritesModule {}
