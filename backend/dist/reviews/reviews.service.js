"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const entities_1 = require("../database/entities");
let ReviewsService = class ReviewsService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async create(dto, userId) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const order = await manager.findOne(entities_1.Order, {
                    where: { id: dto.orderId },
                    lock: { mode: 'pessimistic_read' },
                });
                if (!order)
                    throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
                if (order.userId !== userId) {
                    throw new common_1.ForbiddenException('Bạn không thể đánh giá đơn hàng của người khác');
                }
                if (order.status !== entities_1.OrderStatus.COMPLETED) {
                    throw new common_1.ConflictException('Chỉ có thể đánh giá sau khi đơn hàng hoàn tất');
                }
                if (await manager.exists(entities_1.Review, { where: { orderId: order.id, userId } })) {
                    throw new common_1.ConflictException('Đơn hàng này đã được đánh giá');
                }
                const restaurant = await manager.findOne(entities_1.Restaurant, {
                    where: { id: order.restaurantId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!restaurant)
                    throw new common_1.NotFoundException('Không tìm thấy quán');
                const review = await manager.save(entities_1.Review, manager.create(entities_1.Review, {
                    orderId: order.id,
                    restaurantId: order.restaurantId,
                    userId,
                    rating: dto.rating,
                    comment: dto.comment || undefined,
                }));
                const stats = await manager
                    .createQueryBuilder(entities_1.Review, 'review')
                    .select('AVG(review.rating)', 'rating')
                    .addSelect('COUNT(*)', 'count')
                    .where('review.restaurantId = :restaurantId', { restaurantId: order.restaurantId })
                    .getRawOne();
                restaurant.rating = Number(Number(stats.rating).toFixed(1));
                restaurant.reviewCount = Number(stats.count);
                await manager.save(entities_1.Restaurant, restaurant);
                return review;
            });
        }
        catch (error) {
            if (this.isUniqueViolation(error)) {
                throw new common_1.ConflictException('Đơn hàng này đã được đánh giá');
            }
            throw error;
        }
    }
    async removeByAdmin(id) {
        return this.dataSource.transaction(async (manager) => {
            const review = await manager.findOne(entities_1.Review, { where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!review)
                throw new common_1.NotFoundException('Không tìm thấy đánh giá');
            const restaurant = await manager.findOne(entities_1.Restaurant, { where: { id: review.restaurantId }, lock: { mode: 'pessimistic_write' } });
            await manager.remove(entities_1.Review, review);
            if (restaurant) {
                const stats = await manager.createQueryBuilder(entities_1.Review, 'review').select('COALESCE(AVG(review.rating), 0)', 'rating').addSelect('COUNT(*)', 'count').where('review.restaurantId = :restaurantId', { restaurantId: restaurant.id }).getRawOne();
                restaurant.rating = Number(Number(stats.rating).toFixed(1));
                restaurant.reviewCount = Number(stats.count);
                await manager.save(entities_1.Restaurant, restaurant);
            }
            return { id, deleted: true };
        });
    }
    isUniqueViolation(error) {
        return (error instanceof typeorm_1.QueryFailedError &&
            typeof error.driverError === 'object' &&
            error.driverError !== null &&
            error.driverError.code === '23505');
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map