import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant, RouteSearchLog } from '../database/entities';
import { RouteSearchDto } from './dto/route-search.dto';

interface GoogleDirectionsResponse {
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{ duration?: { value?: number } }>;
  }>;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(RouteSearchLog) private readonly logs: Repository<RouteSearchLog>,
  ) {}

  async route(dto: RouteSearchDto, userId?: string) {
    const route = await this.directions(dto);
    const rows = await this.restaurants.query(
      `SELECT r.*, ST_Distance(r.location, route.line) AS distance_meters,
       (COALESCE(r.rating,0) * 100 - ST_Distance(r.location, route.line) / 10) AS convenience_score
       FROM restaurants r CROSS JOIN (SELECT ST_GeogFromText($1) AS line) route
       WHERE r.active = true AND ST_DWithin(r.location, route.line, $2)
       ORDER BY convenience_score DESC, r.rating DESC`,
      [route.line, dto.radius],
    );
    await this.logs.save(
      this.logs.create({
        pointA: dto.pointA,
        pointB: dto.pointB,
        polyline: route.line,
        radiusMeters: dto.radius,
        userId,
      }),
    );
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

  private async directions(dto: RouteSearchDto) {
    const fallback = `LINESTRING(${dto.pointA.longitude} ${dto.pointA.latitude},${dto.pointB.longitude} ${dto.pointB.latitude})`;
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const fallbackMinutes = this.estimateFallbackMinutes(dto.pointA, dto.pointB);
    if (!key) return { line: fallback, polyline: fallback, provider: 'straight-line-fallback', travelTimeMinutes: fallbackMinutes };
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${dto.pointA.latitude},${dto.pointA.longitude}&destination=${dto.pointB.latitude},${dto.pointB.longitude}&key=${key}`;
      const json = (await (await fetch(url)).json()) as GoogleDirectionsResponse;
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
    } catch {
      return { line: fallback, polyline: fallback, provider: 'straight-line-fallback', travelTimeMinutes: fallbackMinutes };
    }
  }

  private decode(encoded: string): number[][] {
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    const result: number[][] = [];
    while (index < encoded.length) {
      let byte: number;
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

  /** Ước lượng dự phòng từ hai tọa độ khi Directions API chưa cấu hình. */
  private estimateFallbackMinutes(pointA: { latitude: number; longitude: number }, pointB: { latitude: number; longitude: number }) {
    const radians = (value: number) => value * Math.PI / 180;
    const dLat = radians(pointB.latitude - pointA.latitude);
    const dLng = radians(pointB.longitude - pointA.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(pointA.latitude)) * Math.cos(radians(pointB.latitude)) * Math.sin(dLng / 2) ** 2;
    const kilometers = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.ceil((kilometers / 25) * 60));
  }
}
