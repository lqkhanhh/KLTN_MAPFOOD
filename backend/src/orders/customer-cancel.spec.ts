import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, OrderPaymentMethod, UserRole } from '../database/entities';

describe('Customer cancellation authorization', () => {
  const customer = { sub: 'customer', email: 'test@example.com', role: UserRole.CUSTOMER };
  let order: Order;
  const manager = { findOne: jest.fn(), findOneBy: jest.fn(), save: jest.fn() };
  const gateway = { emitStatusUpdated: jest.fn() };
  let service: OrdersService;
  beforeEach(() => {
    jest.resetAllMocks();
    order = { id: 'order', userId: 'customer', restaurantId: 'restaurant', status: OrderStatus.PENDING,
      paymentMethod: OrderPaymentMethod.CASH } as Order;
    manager.findOne.mockImplementation(async () => order);
    manager.findOneBy.mockResolvedValue({ ownerId: 'merchant' });
    const dataSource = { transaction: async (callback: (value: typeof manager) => unknown) => callback(manager) };
    service = new OrdersService(dataSource as never, gateway as never, { create: jest.fn().mockResolvedValue(undefined), publish: jest.fn() } as never, { earn: jest.fn() } as never);
    jest.spyOn(service, 'findEntity').mockImplementation(async () => order);
    jest.spyOn(service, 'toPublicOrder').mockImplementation((value) => value as never);
  });
  it('cancels own pending order, locks it, records actor and emits update', async () => {
    await service.updateStatus('order', OrderStatus.CANCELLED, customer);
    expect(manager.findOne).toHaveBeenCalledWith(Order, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.statusUpdatedById).toBe(customer.sub);
    expect(gateway.emitStatusUpdated).toHaveBeenCalledTimes(1);
  });
  it('rejects another customer and forbids customer promotion to CONFIRMED', async () => {
    await expect(service.updateStatus('order', OrderStatus.CANCELLED, { ...customer, sub: 'other' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateStatus('order', OrderStatus.CONFIRMED, customer)).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  it.each([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED, OrderStatus.CANCELLED])('rejects cancellation after %s', async (status) => {
    order.status = status;
    await expect(service.updateStatus('order', OrderStatus.CANCELLED, customer)).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('preserves merchant ownership and state transition checks', async () => {
    const merchant = { ...customer, sub: 'merchant', role: UserRole.MERCHANT };
    await expect(service.updateStatus('order', OrderStatus.CONFIRMED, { ...merchant, sub: 'wrong' })).rejects.toBeInstanceOf(ForbiddenException);
    await service.updateStatus('order', OrderStatus.CONFIRMED, merchant);
    expect(order.status).toBe(OrderStatus.CONFIRMED);
  });
});
