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
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let SearchService = class SearchService {
    constructor(restaurants, logs) {
        this.restaurants = restaurants;
        this.logs = logs;
    }
    async route(dto, userId) { const line = `LINESTRING(${dto.pointA.longitude} ${dto.pointA.latitude},${dto.pointB.longitude} ${dto.pointB.latitude})`; const rows = await this.restaurants.query(`SELECT r.*, ST_Distance(r.location, route.line) AS distance_meters, (COALESCE(r.rating,0) * 100 - ST_Distance(r.location, route.line) / 10) AS convenience_score FROM restaurants r CROSS JOIN (SELECT ST_GeogFromText($1) AS line) route WHERE ST_DWithin(r.location, route.line, $2) ORDER BY convenience_score DESC, r.rating DESC`, [line, dto.radius]); await this.logs.save(this.logs.create({ pointA: dto.pointA, pointB: dto.pointB, polyline: line, radiusMeters: dto.radius, userId })); return { route: { polyline: line, provider: 'straight-line-fallback' }, radiusMeters: dto.radius, restaurants: rows }; }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.RouteSearchLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository])
], SearchService);
//# sourceMappingURL=search.service.js.map