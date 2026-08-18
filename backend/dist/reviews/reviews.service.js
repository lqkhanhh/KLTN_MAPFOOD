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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let ReviewsService = class ReviewsService {
    constructor(reviews, restaurants) {
        this.reviews = reviews;
        this.restaurants = restaurants;
    }
    async create(dto, userId) { const r = await this.restaurants.findOneBy({ id: dto.restaurantId }); if (!r)
        throw new common_1.NotFoundException('Không tìm thấy quán'); const review = await this.reviews.save(this.reviews.create({ ...dto, userId })); const stats = await this.reviews.createQueryBuilder('v').select('AVG(v.rating)', 'rating').addSelect('COUNT(*)', 'count').where('v.restaurantId=:id', { id: r.id }).getRawOne(); r.rating = Number(stats.rating); r.reviewCount = Number(stats.count); await this.restaurants.save(r); return review; }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Review)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map