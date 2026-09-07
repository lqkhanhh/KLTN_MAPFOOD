import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({ imports: [TypeOrmModule.forFeature([Notification]), AuthModule],
  controllers: [NotificationsController], providers: [NotificationsService, NotificationsGateway], exports: [NotificationsService] })
export class NotificationsModule {}
