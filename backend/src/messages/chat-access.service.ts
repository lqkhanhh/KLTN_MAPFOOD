import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { Restaurant } from '../database/entities/restaurant.entity';
import { Order } from '../database/entities/order.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { MessageSenderRole } from './message.entity';

@Injectable()
export class ChatAccessService {
  constructor(private readonly dataSource: DataSource) {}
  async account(userId: string, manager: EntityManager = this.dataSource.manager) {
    if (!isUUID(userId)) throw new UnauthorizedException();
    const user = await manager.findOne(User, { where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new UnauthorizedException();
    if (![UserRole.CUSTOMER, UserRole.MERCHANT].includes(user.role)) throw new ForbiddenException('Chỉ hai bên của đơn hàng được tham gia chat');
    return user;
  }
  async context(orderId: string, userId: string, manager: EntityManager = this.dataSource.manager) {
    const user = await this.account(userId, manager);
    if (!isUUID(orderId)) throw new NotFoundException('Không tìm thấy đơn hàng');
    const lock = manager.queryRunner?.isTransactionActive ? { mode: 'pessimistic_read' as const } : undefined;
    const order = await manager.findOne(Order, { where: { id: orderId }, lock });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const restaurant = await manager.findOne(Restaurant, { where: { id: order.restaurantId }, lock });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
    // Vai trò trong cuộc trò chuyện lấy từ quan hệ đơn/quán, không lấy từ body do client gửi.
    if (order.userId === userId) return { role: MessageSenderRole.CUSTOMER, order, recipientId: restaurant.ownerId };
    if (user.role === UserRole.MERCHANT && restaurant.ownerId === userId) return { role: MessageSenderRole.MERCHANT, order, recipientId: order.userId };
    throw new ForbiddenException('Bạn không có quyền truy cập cuộc trò chuyện của đơn này');
  }
  async participant(orderId: string, userId: string): Promise<MessageSenderRole> {
    return (await this.context(orderId, userId)).role;
  }
}
