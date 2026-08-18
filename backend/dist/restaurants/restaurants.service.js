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
    constructor(repo) {
        this.repo = repo;
    }
    async findOne(id) { const r = await this.repo.findOne({ where: { id }, relations: ['menuItems', 'reviews'] }); if (!r)
        throw new common_1.NotFoundException('Không tìm thấy quán'); return r; }
    create(dto, user) { return this.repo.save(this.repo.create({ name: dto.name, address: dto.address, openingHours: dto.openingHours, ownerId: user.sub, location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] }, menuItems: dto.menuItems })); }
    async update(id, dto, user) { const r = await this.findOne(id); if (r.ownerId !== user.sub && user.role !== entities_1.UserRole.ADMIN)
        throw new common_1.ForbiddenException(); Object.assign(r, { name: dto.name, address: dto.address, openingHours: dto.openingHours, location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] } }); if (dto.menuItems)
        r.menuItems = dto.menuItems; return this.repo.save(r); }
};
exports.RestaurantsService = RestaurantsService;
exports.RestaurantsService = RestaurantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RestaurantsService);
//# sourceMappingURL=restaurants.service.js.map