import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { OrdersService } from '../orders/orders.service';
import { OrderPaymentMethod, OrderStatus, UserRole } from '../database/entities';

describe('Thông báo: quyền sở hữu và tính nhất quán với đơn hàng', () => {
  it('giới hạn danh sách 50 nhưng đếm toàn bộ chưa đọc của đúng user', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(60) };
    const service = new NotificationsService(repo as never, {} as never);
    expect(await service.findAllForUser('customer')).toEqual({ notifications: [], unreadCount: 60 });
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'customer' }, take: 50 }));
    expect(repo.count).toHaveBeenCalledWith({ where: { userId: 'customer', isRead: false } });
  });
  it('không cho đọc thông báo của người khác, read-all chỉ cập nhật chính user', async () => {
    const repo = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
    const gateway = { emitRead: jest.fn() };
    const service = new NotificationsService(repo as never, gateway as never);
    await expect(service.markAsRead('id', 'other')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).toHaveBeenCalledWith({ id: 'id', userId: 'other' }, { isRead: true });
    expect(gateway.emitRead).not.toHaveBeenCalled();
    await service.markAllAsRead('customer');
    expect(repo.update).toHaveBeenLastCalledWith({ userId: 'customer', isRead: false }, { isRead: true });
  });
  it.each([
    [OrderStatus.PENDING, OrderStatus.CONFIRMED], [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
    [OrderStatus.PREPARING, OrderStatus.READY], [OrderStatus.READY, OrderStatus.COMPLETED],
    [OrderStatus.PENDING, OrderStatus.CANCELLED],
  ])('lưu thông báo %s → %s trước commit, phát sau commit', async (initial, next) => {
    const events: string[] = [];
    const order = { id: 'order', orderCode: 'ORD-DEMO', userId: 'customer', restaurantId: 'restaurant', status: initial, paymentMethod: OrderPaymentMethod.CASH };
    const notification = { userId: 'customer', id: 'notice' };
    const manager = { findOne: async () => order, findOneBy: async () => ({ ownerId: 'merchant' }), save: async () => { events.push('save-order'); } };
    const notifications = {
      create: jest.fn(async () => { events.push('save-notice'); return notification; }),
      publish: jest.fn(() => { events.push('emit-notice'); }),
    };
    const ds = { transaction: async (callback: any) => { const result = await callback(manager); events.push('commit'); return result; } };
    const service = new OrdersService(ds as never, { emitStatusUpdated: jest.fn() } as never, notifications as never, { earn: jest.fn() } as never);
    jest.spyOn(service, 'findEntity').mockResolvedValue(order as never);
    jest.spyOn(service, 'toPublicOrder').mockImplementation((value) => value as never);
    await service.updateStatus('order', next, { sub: 'merchant', role: UserRole.MERCHANT, email: 'm@test.local' });
    expect(events).toEqual(['save-order', 'save-notice', 'commit', 'emit-notice']);
    expect(notifications.create).toHaveBeenCalledWith('customer', 'Cập nhật đơn hàng', expect.any(String), { orderId: 'order', type: 'order_status', status: next }, manager);
  });
  it('không phát socket nếu transaction thất bại', async () => {
    const notifications = { create: jest.fn().mockRejectedValue(new Error('write failed')), publish: jest.fn() };
    const order = { id: 'order', userId: 'customer', status: OrderStatus.PENDING };
    const manager = { findOne: async () => order, findOneBy: async () => ({ ownerId: 'merchant' }), save: jest.fn() };
    const service = new OrdersService({ transaction: (callback: any) => callback(manager) } as never, {} as never, notifications as never, { earn: jest.fn() } as never);
    await expect(service.updateStatus('order', OrderStatus.CONFIRMED, { sub: 'merchant', role: UserRole.MERCHANT, email: 'm@test.local' })).rejects.toThrow('write failed');
    expect(notifications.publish).not.toHaveBeenCalled();
  });
});
