import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Order, OrderStatus, Restaurant, Review } from '../database/entities';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const order = {
    id: '22222222-2222-4222-8222-222222222222',
    userId,
    restaurantId: '33333333-3333-4333-8333-333333333333',
    status: OrderStatus.COMPLETED,
  } as Order;
  const restaurant = {
    id: order.restaurantId,
    rating: 0,
    reviewCount: 0,
  } as Restaurant;

  let manager: {
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let service: ReviewsService;

  beforeEach(() => {
    manager = {
      findOne: jest.fn((entity) => Promise.resolve(entity === Order ? order : restaurant)),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((_entity, value) => value),
      save: jest.fn((_entity, value) => Promise.resolve({ ...value, id: 'review-1' })),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ rating: '5', count: '1' }),
      })),
    };
    const dataSource = {
      transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
        callback(manager as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    service = new ReviewsService(dataSource);
  });

  it('rejects a review for an unfinished order', async () => {
    manager.findOne.mockResolvedValueOnce({ ...order, status: OrderStatus.PREPARING });
    await expect(
      service.create({ orderId: order.id, rating: 5 }, userId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a review by someone other than the order owner', async () => {
    await expect(
      service.create({ orderId: order.id, rating: 5 }, 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('returns conflict when the order was already reviewed', async () => {
    manager.exists.mockResolvedValue(true);
    await expect(
      service.create({ orderId: order.id, rating: 5 }, userId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates one review and updates restaurant aggregate in the transaction', async () => {
    const result = await service.create(
      { orderId: order.id, rating: 5, comment: 'Món ngon' },
      userId,
    );
    expect(result).toMatchObject({ id: 'review-1', orderId: order.id, rating: 5 });
    expect(restaurant).toMatchObject({ rating: 5, reviewCount: 1 });
    expect(manager.save).toHaveBeenCalledWith(Review, expect.objectContaining({ userId }));
    expect(manager.save).toHaveBeenCalledWith(Restaurant, restaurant);
  });
});
