import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Order, OrderPaymentStatus, Restaurant, RouteSearchLog, User } from '../database/entities';
import { AdminRestaurantQueryDto, AdminUserQueryDto } from './dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Restaurant) private readonly restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(RouteSearchLog) private readonly routesRepo: Repository<RouteSearchLog>,
  ) {}

  async overview() {
    const [userRoles, restaurantCount, orderCount, gmv, newUsers, topRestaurants] = await Promise.all([
      this.usersRepo.createQueryBuilder('user').select('user.role', 'role').addSelect('COUNT(*)', 'count').groupBy('user.role').getRawMany(),
      this.restaurantsRepo.count(), this.ordersRepo.count(),
      this.ordersRepo.createQueryBuilder('order').select('COALESCE(SUM(order.totalAmount), 0)', 'gmv').where('order.paymentStatus = :paid', { paid: OrderPaymentStatus.PAID }).getRawOne(),
      this.usersRepo.createQueryBuilder('user').where(`user.createdAt >= date_trunc('month', NOW())`).getCount(),
      this.ordersRepo.createQueryBuilder('order').innerJoin('order.restaurant', 'restaurant').select('restaurant.id', 'id').addSelect('restaurant.name', 'name').addSelect('COUNT(order.id)', 'orderCount').groupBy('restaurant.id').addGroupBy('restaurant.name').orderBy('COUNT(order.id)', 'DESC').limit(5).getRawMany(),
    ]);
    return { usersByRole: userRoles.map((row) => ({ role: row.role, count: Number(row.count) })), totalRestaurants: restaurantCount, totalOrders: orderCount, gmv: Number(gmv?.gmv || 0), newUsersThisMonth: newUsers, topRestaurants: topRestaurants.map((row) => ({ ...row, orderCount: Number(row.orderCount) })) };
  }

  async searchAnalytics() {
    const [total, popularOrigins] = await Promise.all([
      this.routesRepo.count(),
      this.routesRepo.createQueryBuilder('route').select(`route.pointA->>'latitude'`, 'latitude').addSelect(`route.pointA->>'longitude'`, 'longitude').addSelect('COUNT(*)', 'count').groupBy(`route.pointA->>'latitude'`).addGroupBy(`route.pointA->>'longitude'`).orderBy('COUNT(*)', 'DESC').limit(10).getRawMany(),
    ]);
    return { totalSearches: total, popularOriginAreas: popularOrigins.map((row) => ({ latitude: Number(row.latitude), longitude: Number(row.longitude), count: Number(row.count) })), note: 'Hiện chỉ lưu route log; cần thêm conversion event để đo tỷ lệ xuất hiện/đặt món theo quán.' };
  }

  async restaurants(query: AdminRestaurantQueryDto) {
    const qb = this.restaurantsRepo.createQueryBuilder('restaurant').leftJoin('restaurant.owner', 'owner').select(['restaurant', 'owner.id', 'owner.email', 'owner.fullName']);
    if (query.active !== undefined) qb.andWhere('restaurant.active = :active', { active: query.active });
    if (query.source) qb.andWhere('restaurant.source = :source', { source: query.source });
    if (query.search?.trim()) qb.andWhere('restaurant.name ILIKE :search', { search: `%${query.search.trim()}%` });
    const [rows, total] = await qb.orderBy('restaurant.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data: rows, page: query.page, limit: query.limit, total };
  }

  async users(query: AdminUserQueryDto) {
    const qb = this.usersRepo.createQueryBuilder('user').select(['user.id', 'user.email', 'user.fullName', 'user.phone', 'user.role', 'user.createdAt', 'user.updatedAt']);
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    const search = query.search?.trim();
    if (search) qb.andWhere(new Brackets((where) => where.where('user.email ILIKE :search', { search: `%${search}%` }).orWhere('user.fullName ILIKE :search', { search: `%${search}%` })));
    const [rows, total] = await qb.orderBy('user.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data: rows, page: query.page, limit: query.limit, total };
  }

  async suspend(id: string, reason: string) { const restaurant = await this.restaurantsRepo.findOneBy({ id }); if (!restaurant) throw new NotFoundException('Không tìm thấy quán'); restaurant.active = false; restaurant.suspendedReason = reason.trim(); restaurant.suspendedAt = new Date(); return this.restaurantsRepo.save(restaurant); }
  async activate(id: string) { const restaurant = await this.restaurantsRepo.findOneBy({ id }); if (!restaurant) throw new NotFoundException('Không tìm thấy quán'); restaurant.active = true; restaurant.suspendedReason = undefined; restaurant.suspendedAt = undefined; return this.restaurantsRepo.save(restaurant); }
}
