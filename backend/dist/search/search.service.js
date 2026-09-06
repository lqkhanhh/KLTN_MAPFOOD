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
    async route(dto, userId) {
        const route = await this.directions(dto);
        const rows = await this.restaurants.query(`SELECT r.*, ST_Distance(r.location, route.line) AS distance_meters,
       (COALESCE(r.rating,0) * 100 - ST_Distance(r.location, route.line) / 10) AS convenience_score
       FROM restaurants r CROSS JOIN (SELECT ST_GeogFromText($1) AS line) route
       WHERE r.active = true AND ST_DWithin(r.location, route.line, $2)
       ORDER BY convenience_score DESC, r.rating DESC`, [route.line, dto.radius]);
        await this.logs.save(this.logs.create({
            pointA: dto.pointA,
            pointB: dto.pointB,
            polyline: route.line,
            radiusMeters: dto.radius,
            userId,
        }));
        return {
            route: {
                polyline: route.polyline,
                provider: route.provider,
                travelTimeMinutes: route.travelTimeMinutes,
            },
            radiusMeters: dto.radius,
            restaurants: rows,
        };
    }
    async directions(dto) {
        const fallback = `LINESTRING(${dto.pointA.longitude} ${dto.pointA.latitude},${dto.pointB.longitude} ${dto.pointB.latitude})`;
        const key = process.env.GOOGLE_MAPS_API_KEY;
        const fallbackMinutes = this.estimateFallbackMinutes(dto.pointA, dto.pointB);
        if (!key)
            return { line: fallback, polyline: fallback, provider: 'straight-line-fallback', travelTimeMinutes: fallbackMinutes };
        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${dto.pointA.latitude},${dto.pointA.longitude}&destination=${dto.pointB.latitude},${dto.pointB.longitude}&key=${key}`;
            const json = (await (await fetch(url)).json());
            const googleRoute = json.routes?.[0];
            const encoded = googleRoute?.overview_polyline?.points;
            if (!encoded) {
                return { line: fallback, polyline: fallback, provider: 'straight-line-fallback', travelTimeMinutes: fallbackMinutes };
            }
            const coordinates = this.decode(encoded)
                .map(([latitude, longitude]) => `${longitude} ${latitude}`)
                .join(',');
            return {
                line: `LINESTRING(${coordinates})`,
                polyline: encoded,
                provider: 'google-directions',
                travelTimeMinutes: Math.max(1, Math.ceil((googleRoute?.legs ?? []).reduce((total, leg) => total + (leg.duration?.value ?? 0), 0) / 60)),
            };
        }
        catch {
            return { line: fallback, polyline: fallback, provider: 'straight-line-fallback', travelTimeMinutes: fallbackMinutes };
        }
    }
    decode(encoded) {
        let index = 0;
        let latitude = 0;
        let longitude = 0;
        const result = [];
        while (index < encoded.length) {
            let byte;
            let shift = 0;
            let value = 0;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                value |= (byte & 31) << shift;
                shift += 5;
            } while (byte >= 32);
            latitude += value & 1 ? ~(value >> 1) : value >> 1;
            shift = 0;
            value = 0;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                value |= (byte & 31) << shift;
                shift += 5;
            } while (byte >= 32);
            longitude += value & 1 ? ~(value >> 1) : value >> 1;
            result.push([latitude / 1e5, longitude / 1e5]);
        }
        return result;
    }
    estimateFallbackMinutes(pointA, pointB) {
        const radians = (value) => value * Math.PI / 180;
        const dLat = radians(pointB.latitude - pointA.latitude);
        const dLng = radians(pointB.longitude - pointA.longitude);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(pointA.latitude)) * Math.cos(radians(pointB.latitude)) * Math.sin(dLng / 2) ** 2;
        const kilometers = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.max(1, Math.ceil((kilometers / 25) * 60));
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.RouteSearchLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], SearchService);
//# sourceMappingURL=search.service.js.map