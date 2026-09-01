import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  MenuItem,
  Order,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  Restaurant,
  UserRole,
} from '../database/entities';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const customer: AuthenticatedUser = {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
  };
  const merchant: AuthenticatedUser = {
    sub: '22222222-2222-4222-8222-222222222222',
    email: 'merchant@example.com',
    role: UserRole.MERCHANT,
  };
  const restaurant = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'RouteBite Kitchen',
    address: 'HCMC',
    active: true,
    ownerId: merchant.sub,
  } as Restaurant;
  const menuItem = {
    id: '44444444-4444-4444-8444-444444444444',
    restaurantId: restaurant.id,
    name: 'Cơm gà',
    price: 50_000,
    available: true,
  } as MenuItem;

  let manager: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let repository: { findOne: jest.Mock; find: jest.Mock; findOneBy: jest.Mock };
  let dataSource: DataSource;
  let gateway: { emitCreated: jest.Mock; emitStatusUpdated: jest.Mock };
  let service: OrdersService;
  let savedOrder: Order | undefined;

  beforeEach(() => {
    savedOrder = undefined;
    manager = {
      findOne: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(restaurant),
      find: jest.fn(),
      create: jest.fn((_entity, value) => value),
      save: jest.fn((entity, value) => {
        if (entity === Order) {
          savedOrder = { ...value, id: value.id ?? '55555555-5555-4555-8555-555555555555' };
          return Promise.resolve(savedOrder);
        }
        return Promise.resolve(value);
      }),
    };
    repository = { findOne: jest.fn(), find: jest.fn(), findOneBy: jest.fn() };
    dataSource = {
      transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
        callback(manager as unknown as EntityManager),
      ),
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
    gateway = { emitCreated: jest.fn(), emitStatusUpdated: jest.fn() };
    service = new OrdersService(dataSource, gateway as never);
  });

  it('creates a BOOKING in a transaction with PENDING/UNPAID', async () => {
    manager.findOne.mockResolvedValue(restaurant);
    repository.findOne.mockImplementation(async () => completeOrder(savedOrder!));

    const result = await service.create(
      {
        restaurantId: restaurant.id,
        type: OrderType.BOOKING,
        customerName: ' Nguyễn Văn A ',
        customerPhone: '0900000000',
        bookingTime: futureIso(),
        guestCount: 4,
        items: [],
      },
      customer,
    );

    expect(savedOrder).toMatchObject({
      userId: customer.sub,
      type: OrderType.BOOKING,
      status: OrderStatus.PENDING,
      paymentStatus: OrderPaymentStatus.UNPAID,
      customerName: 'Nguyễn Văn A',
      subtotal: 0,
      totalAmount: 0,
      guestCount: 4,
    });
    expect(result.type).toBe(OrderType.BOOKING);
    expect(gateway.emitCreated).toHaveBeenCalledTimes(1);
  });

  it('creates a TAKE_AWAY and calculates snapshot totals from the database', async () => {
    manager.findOne.mockResolvedValue(restaurant);
    manager.find.mockResolvedValue([menuItem]);
    repository.findOne.mockImplementation(async () => completeOrder(savedOrder!));

    const result = await service.create(
      {
        restaurantId: restaurant.id,
        type: OrderType.TAKE_AWAY,
        customerName: 'Nguyễn Văn A',
        customerPhone: '0900000000',
        pickupTime: futureIso(),
        items: [{ menuItemId: menuItem.id, quantity: 2, note: ' Không hành ' }],
      },
      customer,
    );

    expect(savedOrder).toMatchObject({ subtotal: 100_000, discountAmount: 0, totalAmount: 100_000 });
    expect(savedOrder!.items[0]).toMatchObject({
      itemName: 'Cơm gà',
      unitPrice: 50_000,
      quantity: 2,
      lineTotal: 100_000,
      note: 'Không hành',
    });
    expect(result.totalAmount).toBe(100_000);
  });

  it('rejects a missing or unavailable menu item', async () => {
    manager.findOne.mockResolvedValue(restaurant);
    manager.find.mockResolvedValue([]);

    await expect(
      service.create(
        {
          restaurantId: restaurant.id,
          type: OrderType.TAKE_AWAY,
          customerName: 'Nguyễn Văn A',
          customerPhone: '0900000000',
          pickupTime: futureIso(),
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
        },
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('prevents a customer from reading another customer order', async () => {
    repository.findOne.mockResolvedValue(
      completeOrder({ ...baseOrder(), userId: 'other-customer' } as Order),
    );
    await expect(service.findOneForUser(baseOrder().id, customer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents a merchant from changing an order of another restaurant', async () => {
    manager.findOne.mockResolvedValue(completeOrder(baseOrder()));
    manager.findOneBy.mockResolvedValue({ ...restaurant, ownerId: 'other-merchant' });
    await expect(
      service.updateStatus(baseOrder().id, OrderStatus.CONFIRMED, merchant),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid status transition', async () => {
    manager.findOne.mockResolvedValue(completeOrder(baseOrder()));
    await expect(
      service.updateStatus(baseOrder().id, OrderStatus.READY, merchant),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(gateway.emitStatusUpdated).not.toHaveBeenCalled();
  });

  it('emits only after a successful status transaction', async () => {
    const pending = completeOrder(baseOrder());
    manager.findOne.mockResolvedValue(pending);
    repository.findOne.mockImplementation(async () =>
      completeOrder({ ...pending, status: OrderStatus.CONFIRMED } as Order),
    );

    await service.updateStatus(pending.id, OrderStatus.CONFIRMED, merchant);

    expect(manager.save).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({ status: OrderStatus.CONFIRMED, statusUpdatedById: merchant.sub }),
    );
    expect(gateway.emitStatusUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.CONFIRMED }),
    );
    expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.emitStatusUpdated.mock.invocationCallOrder[0],
    );
  });

  it('does not emit when the requested status is already current', async () => {
    manager.findOne.mockResolvedValue(completeOrder(baseOrder()));
    repository.findOne.mockResolvedValue(completeOrder(baseOrder()));

    await service.updateStatus(baseOrder().id, OrderStatus.PENDING, merchant);

    expect(manager.save).not.toHaveBeenCalled();
    expect(gateway.emitStatusUpdated).not.toHaveBeenCalled();
  });

  it('does not emit when saving the status transaction fails', async () => {
    manager.findOne.mockResolvedValue(completeOrder(baseOrder()));
    manager.save.mockRejectedValueOnce(new Error('database write failed'));

    await expect(
      service.updateStatus(baseOrder().id, OrderStatus.CONFIRMED, merchant),
    ).rejects.toThrow('database write failed');

    expect(gateway.emitStatusUpdated).not.toHaveBeenCalled();
  });

  function baseOrder(): Order {
    return {
      id: '55555555-5555-4555-8555-555555555555',
      orderCode: 'ORD-20260830-ABC123',
      userId: customer.sub,
      restaurantId: restaurant.id,
      restaurant,
      type: OrderType.TAKE_AWAY,
      status: OrderStatus.PENDING,
      paymentStatus: OrderPaymentStatus.UNPAID,
      subtotal: 50_000,
      discountAmount: 0,
      totalAmount: 50_000,
      customerName: 'Nguyễn Văn A',
      customerPhone: '0900000000',
      pickupTime: new Date(futureIso()),
      items: [],
      payments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Order;
  }

  function completeOrder(order: Order): Order {
    return { ...order, restaurant: order.restaurant ?? restaurant, items: order.items ?? [], payments: [] };
  }

  function futureIso() {
    return new Date(Date.now() + 60_000).toISOString();
  }
});
