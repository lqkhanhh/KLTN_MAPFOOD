import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Order, Restaurant, RouteSearchLog, User } from '../database/entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([User, Restaurant, Order, RouteSearchLog])], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
