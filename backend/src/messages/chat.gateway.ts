import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { isUUID } from 'class-validator';
import { ChatAccessService } from './chat-access.service';
import { Message } from './message.entity';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly access: ChatAccessService) {}
  private verify(token: unknown) {
    if (typeof token !== 'string') throw new Error('Missing token');
    const user = this.jwt.verify<{ sub: string; exp: number }>(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
    if (!isUUID(user.sub) || !Number.isFinite(user.exp)) throw new Error('Invalid token');
    return user;
  }
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const user = this.verify(token); client.data.token = token;
      client.data.expiryTimer = setTimeout(() => client.disconnect(), Math.min(2147483647, Math.max(0, user.exp * 1000 - Date.now())));
      client.data.expiryTimer.unref?.();
    } catch { client.disconnect(); }
  }
  handleDisconnect(client: Socket) { clearTimeout(client.data.expiryTimer); }
  @SubscribeMessage('join-all-my-conversations')
  async joinInbox(@ConnectedSocket() client: Socket) {
    try {
      const user = this.verify(client.data.token);
      await this.access.account(user.sub);
      this.verify(client.data.token);
      if (!client.connected) return { ok: false };
      // Room cá nhân bao phủ cả cuộc trò chuyện mới chưa có lúc kết nối.
      await client.join(`chat-inbox:${user.sub}`);
      return { ok: true };
    } catch { return { ok: false }; }
  }
  publishRead(userId: string, orderId: string) {
    this.server?.to(`chat-inbox:${userId}`).emit('messages.read', { orderId });
  }
  @SubscribeMessage('join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId?: string }) {
    try {
      const user = this.verify(client.data.token);
      await this.access.participant(body?.orderId ?? '', user.sub);
      this.verify(client.data.token);
      if (!client.connected) return { ok: false };
      await client.join(`order-chat:${body.orderId}`);
      return { ok: true };
    } catch { return { ok: false, error: 'Bạn không có quyền mở cuộc trò chuyện này hoặc phiên đã hết hạn.' }; }
  }
  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId?: string }) {
    if (isUUID(body?.orderId)) await client.leave(`order-chat:${body.orderId}`);
    return { ok: true };
  }
  async publish(message: Message, participantIds: string[] = []) {
    if (!this.server) return;
    try {
      const room = `order-chat:${message.orderId}`;
      const clients = await this.server.in([room, ...participantIds.map((id) => `chat-inbox:${id}`)]).fetchSockets();
      await Promise.all(clients.map(async (client) => {
        try {
          const user = this.verify(client.data.token);
          // Kiểm tra lại trước khi phát: token hết hạn hoặc quyền quán đổi không được nhận tin mới.
          await this.access.participant(message.orderId, user.sub);
          this.verify(client.data.token);
          client.emit('message.new', message);
        } catch { await client.leave(room); }
      }));
    } catch { this.logger.warn('Không phát được tin realtime; client có thể tải lại lịch sử qua API.'); }
  }
}
