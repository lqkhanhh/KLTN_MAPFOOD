import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Order, OrderStatus, Restaurant, Review } from '../database/entities';
import { CreateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateReviewDto, userId: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const order = await manager.findOne(Order, {
          where: { id: dto.orderId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
        if (order.userId !== userId) {
          throw new ForbiddenException('Bạn không thể đánh giá đơn hàng của người khác');
        }
        if (order.status !== OrderStatus.COMPLETED) {
          throw new ConflictException('Chỉ có thể đánh giá sau khi đơn hàng hoàn tất');
        }
        if (await manager.exists(Review, { where: { orderId: order.id, userId } })) {
          throw new ConflictException('Đơn hàng này đã được đánh giá');
        }

        const restaurant = await manager.findOne(Restaurant, {
          where: { id: order.restaurantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!restaurant) throw new NotFoundException('Không tìm thấy quán');

        const review = await manager.save(
          Review,
          manager.create(Review, {
            orderId: order.id,
            restaurantId: order.restaurantId,
            userId,
            rating: dto.rating,
            comment: dto.comment || undefined,
          }),
        );
        const stats = await manager
          .createQueryBuilder(Review, 'review')
          .select('AVG(review.rating)', 'rating')
          .addSelect('COUNT(*)', 'count')
          .where('review.restaurantId = :restaurantId', { restaurantId: order.restaurantId })
          .getRawOne<{ rating: string; count: string }>();
        restaurant.rating = Number(Number(stats!.rating).toFixed(1));
        restaurant.reviewCount = Number(stats!.count);
        await manager.save(Restaurant, restaurant);
        return review;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Đơn hàng này đã được đánh giá');
      }
      throw error;
    }
  }

  async removeByAdmin(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const review = await manager.findOne(Review, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!review) throw new NotFoundException('Không tìm thấy đánh giá');
      const restaurant = await manager.findOne(Restaurant, { where: { id: review.restaurantId }, lock: { mode: 'pessimistic_write' } });
      await manager.remove(Review, review);
      if (restaurant) {
        const stats = await manager.createQueryBuilder(Review, 'review').select('COALESCE(AVG(review.rating), 0)', 'rating').addSelect('COUNT(*)', 'count').where('review.restaurantId = :restaurantId', { restaurantId: restaurant.id }).getRawOne<{ rating: string; count: string }>();
        restaurant.rating = Number(Number(stats!.rating).toFixed(1)); restaurant.reviewCount = Number(stats!.count); await manager.save(Restaurant, restaurant);
      }
      return { id, deleted: true };
    });
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof QueryFailedError &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
