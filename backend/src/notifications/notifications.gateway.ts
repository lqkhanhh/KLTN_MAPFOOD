import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Namespace;
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  afterInit(server: Namespace) {
    server.use((client, next) => {
      try {
        const token = client.handshake.auth?.token;
        if (typeof token !== 'string') throw new Error();
        const user = this.jwt.verify<AuthenticatedUser & { exp: number }>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        if (!isUUID(user.sub) || !Number.isFinite(user.exp)) throw new Error();
        client.data.user = user;
        next();
      } catch { next(new Error('UNAUTHORIZED')); }
    });
  }

  handleConnection(client: Socket) {
    // Danh tính chỉ lấy từ JWT đã xác thực; không có sự kiện join tùy ý từ client.
    const user = client.data.user;
    void client.join(`user:${user.sub}`);
    const timer = setTimeout(() => client.disconnect(), Math.min(2147483647, Math.max(0, user.exp * 1000 - Date.now())));
    timer.unref();
    client.once('disconnect', () => clearTimeout(timer));
  }

  emitNewNotification(userId: string, notification: Notification) {
    this.server?.to(`user:${userId}`).emit('notification.new', notification);
  }

  emitRead(userId: string) {
    this.server?.to(`user:${userId}`).emit('notification.read');
  }
}
