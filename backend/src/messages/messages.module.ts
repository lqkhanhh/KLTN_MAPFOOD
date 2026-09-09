import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Message } from './message.entity';
import { MessagesController, ConversationsController } from './messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesService } from './messages.service';
import { ChatAccessService } from './chat-access.service';
import { ChatGateway } from './chat.gateway';

@Module({ imports: [AuthModule, NotificationsModule, TypeOrmModule.forFeature([Message])], controllers: [MessagesController, ConversationsController],
  providers: [MessagesService, ChatAccessService, ChatGateway] })
export class MessagesModule {}
