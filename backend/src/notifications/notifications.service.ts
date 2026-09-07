import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>, private readonly gateway: NotificationsGateway) {}

  // Có thể lưu trong transaction của đơn hàng; chỉ publish sau khi commit.
  create(userId: string, title: string, body: string, data: Record<string, unknown> | null = null, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(Notification) : this.repo;
    return repository.save(repository.create({ userId, title, body, data, isRead: false }));
  }
  publish(notification?: Notification) {
    if (notification) this.gateway.emitNewNotification(notification.userId, notification);
  }
  async createAndNotify(userId: string, title: string, body: string, data: Record<string, unknown> | null = null) {
    const notification = await this.create(userId, title, body, data);
    this.publish(notification);
    return notification;
  }
  async findAllForUser(userId: string) {
    const [notifications, unreadCount] = await Promise.all([
      this.repo.find({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' }, take: 50 }),
      // Đếm toàn bộ thông báo chưa đọc, kể cả những bản ghi ngoài 50 dòng mới nhất.
      this.repo.count({ where: { userId, isRead: false } }),
    ]);
    return { notifications, unreadCount };
  }
  async markAsRead(id: string, userId: string) {
    const result = await this.repo.update({ id, userId }, { isRead: true });
    if (!result.affected) throw new NotFoundException('Không tìm thấy thông báo');
    this.gateway.emitRead(userId);
    return { success: true };
  }
  async markAllAsRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    this.gateway.emitRead(userId);
    return { success: true };
  }
}
