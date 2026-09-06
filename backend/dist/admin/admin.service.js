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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let AdminService = class AdminService {
    constructor(usersRepo, restaurantsRepo, ordersRepo, routesRepo) {
        this.usersRepo = usersRepo;
        this.restaurantsRepo = restaurantsRepo;
        this.ordersRepo = ordersRepo;
        this.routesRepo = routesRepo;
    }
    async overview() {
        const [userRoles, restaurantCount, orderCount, gmv, newUsers, topRestaurants] = await Promise.all([
            this.usersRepo.createQueryBuilder('user').select('user.role', 'role').addSelect('COUNT(*)', 'count').groupBy('user.role').getRawMany(),
            this.restaurantsRepo.count(), this.ordersRepo.count(),
            this.ordersRepo.createQueryBuilder('order').select('COALESCE(SUM(order.totalAmount), 0)', 'gmv').where('order.paymentStatus = :paid', { paid: entities_1.OrderPaymentStatus.PAID }).getRawOne(),
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
    async restaurants(query) {
        const qb = this.restaurantsRepo.createQueryBuilder('restaurant').leftJoin('restaurant.owner', 'owner').select(['restaurant', 'owner.id', 'owner.email', 'owner.fullName']);
        if (query.active !== undefined)
            qb.andWhere('restaurant.active = :active', { active: query.active });
        if (query.source)
            qb.andWhere('restaurant.source = :source', { source: query.source });
        if (query.search?.trim())
            qb.andWhere('restaurant.name ILIKE :search', { search: `%${query.search.trim()}%` });
        const [rows, total] = await qb.orderBy('restaurant.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
        return { data: rows, page: query.page, limit: query.limit, total };
    }
    async users(query) {
        const qb = this.usersRepo.createQueryBuilder('user').select(['user.id', 'user.email', 'user.fullName', 'user.phone', 'user.role', 'user.createdAt', 'user.updatedAt']);
        if (query.role)
            qb.andWhere('user.role = :role', { role: query.role });
        const search = query.search?.trim();
        if (search)
            qb.andWhere(new typeorm_2.Brackets((where) => where.where('user.email ILIKE :search', { search: `%${search}%` }).orWhere('user.fullName ILIKE :search', { search: `%${search}%` })));
        const [rows, total] = await qb.orderBy('user.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
        return { data: rows, page: query.page, limit: query.limit, total };
    }
    async suspend(id, reason) { const restaurant = await this.restaurantsRepo.findOneBy({ id }); if (!restaurant)
        throw new common_1.NotFoundException('Không tìm thấy quán'); restaurant.active = false; restaurant.suspendedReason = reason.trim(); restaurant.suspendedAt = new Date(); return this.restaurantsRepo.save(restaurant); }
    async activate(id) { const restaurant = await this.restaurantsRepo.findOneBy({ id }); if (!restaurant)
        throw new common_1.NotFoundException('Không tìm thấy quán'); restaurant.active = true; restaurant.suspendedReason = undefined; restaurant.suspendedAt = undefined; return this.restaurantsRepo.save(restaurant); }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.Order)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.RouteSearchLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminService);
//# sourceMappingURL=admin.service.js.map