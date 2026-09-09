import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Message, MessageSenderRole } from './message.entity';
import { UserRole } from '../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatAccessService } from './chat-access.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class MessagesService {
  constructor(@InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly access: ChatAccessService, private readonly gateway: ChatGateway,
    private readonly ds: DataSource, private readonly notifications: NotificationsService) {}
  async list(orderId: string, userId: string) {
    await this.access.participant(orderId, userId);
    return this.messages.find({ where: { orderId }, order: { createdAt: 'ASC', id: 'ASC' } });
  }
  async send(orderId: string, userId: string, content: string) {
    const result = await this.ds.transaction(async (manager) => {
      const { role, recipientId } = await this.access.context(orderId, userId, manager);
      const message = await manager.save(Message, manager.create(Message, { orderId, senderId: userId, senderRole: role, content }));
      const notification = await this.notifications.create(recipientId, 'Tin nhắn mới', content.length > 50 ? content.slice(0, 50) + '…' : content,
        { orderId, messageId: message.id, type: 'new_message' }, manager);
      return { message, notification, recipientId };
    });
    this.notifications.publish(result.notification);
    await this.gateway.publish(result.message, [userId, result.recipientId]);
    return result.message;
  }
  async read(orderId: string, userId: string, messageIds: string[]) {
    const readIds: string[] = await this.ds.transaction(async (manager) => {
      const { role } = await this.access.context(orderId, userId, manager);
      // Chỉ đánh dấu các tin đã tải/hiển thị, không đánh dấu tin vừa tới sau đó.
      const result = await manager.createQueryBuilder().update(Message).set({ isRead: true }).where({ id: In(messageIds), orderId, isRead: false,
        senderRole: role === MessageSenderRole.CUSTOMER ? MessageSenderRole.MERCHANT : MessageSenderRole.CUSTOMER }).returning('id').execute();
      return result.raw.map((row: { id: string }) => row.id);
    });
    if (readIds.length) this.gateway.publishRead(userId, orderId);
    return { readCount: readIds.length, messageIds: readIds };
  }
  async conversations(userId: string) {
    const user = await this.access.account(userId);
    // LATERAL lấy tin cuối mỗi đơn, không tạo chuỗi N+1 truy vấn theo danh sách đơn.
    const rows = await this.ds.query(`SELECT o.id AS "orderId", o."orderCode", r.name AS "restaurantName", u."fullName" AS "customerName",
      row_to_json(last_message) AS "lastMessage",
      (SELECT COUNT(*)::int FROM messages m WHERE m."orderId" = o.id AND m."isRead" = false
        AND m."senderRole"::text = CASE WHEN o."userId" = $1 THEN 'merchant' ELSE 'customer' END) AS "unreadCount"
      FROM orders o JOIN restaurants r ON r.id = o."restaurantId" JOIN users u ON u.id = o."userId"
      JOIN LATERAL (SELECT m.id, m."orderId", m."senderId", m."senderRole", m.content, m."isRead", m."createdAt"
        FROM messages m WHERE m."orderId" = o.id ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1) last_message ON true
      WHERE o."userId" = $1 OR ($2 = true AND r."ownerId" = $1)
      ORDER BY last_message."createdAt" DESC, last_message.id DESC`, [userId, user.role === UserRole.MERCHANT]);
    return rows;
  }
}
