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
exports.RestaurantsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let RestaurantsService = class RestaurantsService {
    constructor(restaurants) {
        this.restaurants = restaurants;
    }
    async findPublic(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const qb = this.restaurants
            .createQueryBuilder('restaurant')
            .leftJoinAndSelect('restaurant.menuItems', 'menuItems')
            .where('restaurant.active = :active', { active: true });
        if (query.category?.trim()) {
            qb.andWhere('restaurant.category = :category', { category: query.category.trim() });
        }
        if (query.search?.trim()) {
            const search = `%${query.search.trim()}%`;
            qb.andWhere(new typeorm_2.Brackets((where) => where
                .where('restaurant.name ILIKE :search', { search })
                .orWhere('menuItems.name ILIKE :search', { search })));
        }
        const [data, total] = await qb
            .orderBy('restaurant.rating', 'DESC')
            .addOrderBy('restaurant.reviewCount', 'DESC')
            .addOrderBy('restaurant.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return { data, total, page, limit };
    }
    findMine(user) {
        return this.restaurants.find({
            where: user.role === entities_1.UserRole.ADMIN ? {} : { ownerId: user.sub },
            relations: ['menuItems'],
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const restaurant = await this.restaurants.findOne({
            where: { id },
            relations: ['menuItems', 'reviews'],
        });
        if (!restaurant)
            throw new common_1.NotFoundException('Không tìm thấy quán');
        return restaurant;
    }
    create(dto, user) {
        return this.restaurants.save(this.restaurants.create({
            name: dto.name,
            address: dto.address,
            category: dto.category?.trim() || undefined,
            imageUrl: dto.imageUrl?.trim() || undefined,
            openingHours: dto.openingHours,
            active: dto.active ?? true,
            ownerId: user.sub,
            location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
            menuItems: dto.menuItems?.map((item) => this.restaurants.manager.create(entities_1.MenuItem, item)),
        }));
    }
    async update(id, dto, user) {
        const restaurant = await this.findOne(id);
        if (restaurant.ownerId !== user.sub && user.role !== entities_1.UserRole.ADMIN) {
            throw new common_1.ForbiddenException();
        }
        Object.assign(restaurant, {
            name: dto.name,
            address: dto.address,
            category: dto.category?.trim() || undefined,
            imageUrl: dto.imageUrl?.trim() || undefined,
            openingHours: dto.openingHours,
            active: dto.active ?? restaurant.active,
            location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
        });
        if (dto.menuItems) {
            restaurant.menuItems = dto.menuItems.map((item) => this.restaurants.manager.create(entities_1.MenuItem, item));
        }
        return this.restaurants.save(restaurant);
    }
};
exports.RestaurantsService = RestaurantsService;
exports.RestaurantsService = RestaurantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RestaurantsService);
//# sourceMappingURL=restaurants.service.js.map