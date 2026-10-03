import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant, RouteSearchLog } from '../database/entities';
import { RouteSearchDto } from './dto/route-search.dto';

type Point = { latitude: number; longitude: number };
type RoadRoute = { line: string; polyline: string; distanceMeters: number; durationSeconds: number; travelTimeMinutes: number; provider: string };
type Candidate = Restaurant & { latitude: number; longitude: number; distance_meters: number };

@Injectable()
export class SearchService {
  private inflight = 0;
  constructor(
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(RouteSearchLog) private readonly logs: Repository<RouteSearchLog>,
  ) {}

  async route(dto: RouteSearchDto, userId?: string) {
    if (this.inflight >= 3) throw new ServiceUnavailableException('Tìm tuyến đang bận. Vui lòng thử lại sau.');
    this.inflight++;
    try {
      const route = await this.directions(dto);
      // Spatial distance only selects candidates, never claims to be a driving detour.
      const candidates: Candidate[] = await this.restaurants.query(
        `SELECT r.*, ST_Y(r.location::geometry) AS latitude, ST_X(r.location::geometry) AS longitude,
         ST_Distance(r.location, route.line) AS distance_meters
         FROM restaurants r CROSS JOIN (SELECT ST_GeogFromText($1) AS line) route
         WHERE r.active = true AND r."suspendedAt" IS NULL AND r."suspendedReason" IS NULL
           AND ST_DWithin(r.location, route.line, $2)
         ORDER BY distance_meters ASC, r.id ASC LIMIT 13`, [route.line, dto.radius]);
      const selected = candidates.slice(0, 12);
      const results: Array<Candidate & { detourDistanceMeters: number; detourDurationSeconds: number; viaRoute: RoadRoute }> = [];
      let next = 0, failed = 0;
      // At most three provider requests at a time, twelve candidate routes per search.
      await Promise.all(Array.from({ length: Math.min(3, selected.length) }, async () => {
        while (next < selected.length) {
          const shop = selected[next++];
          try {
            const viaRoute = await this.directions(dto, { latitude: Number(shop.latitude), longitude: Number(shop.longitude) });
            results.push({ ...shop, detourDistanceMeters: Math.max(0, viaRoute.distanceMeters - route.distanceMeters),
              detourDurationSeconds: Math.max(0, viaRoute.durationSeconds - route.durationSeconds), viaRoute });
          } catch { failed++; }
        }
      }));
      if (selected.length && !results.length) throw new BadGatewayException('Chưa tính được đường ghé các quán. Vui lòng thử lại.');
      results.sort((a, b) => a.detourDurationSeconds - b.detourDurationSeconds || a.detourDistanceMeters - b.detourDistanceMeters || a.id.localeCompare(b.id));
      await this.logs.save(this.logs.create({ pointA: dto.pointA, pointB: dto.pointB, polyline: route.line, radiusMeters: dto.radius, userId }));
      return { route, radiusMeters: dto.radius, restaurants: results, candidateLimit: 12,
        truncated: candidates.length > 12, unavailableRoutes: failed, travelMode: dto.travelMode,
        warning: failed ? `${failed} quán chưa tính được đường ghé nên không được xếp hạng.` : null };
    } finally { this.inflight--; }
  }

  private async directions(dto: RouteSearchDto, stop?: Point): Promise<RoadRoute> {
    const key = (process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)?.trim();
    if (!key) throw new ServiceUnavailableException('Chưa cấu hình Google Routes. Không thể tính tuyến đường chạy xe.');
    const waypoint = (point: Point) => ({ location: { latLng: point } });
    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline' },
        body: JSON.stringify({ origin: waypoint(dto.pointA), destination: waypoint(dto.pointB),
          ...(stop ? { intermediates: [waypoint(stop)] } : {}), travelMode: dto.travelMode || 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE', polylineQuality: 'HIGH_QUALITY', languageCode: 'vi', units: 'METRIC' }),
      });
      if (!response.ok) throw new Error('Provider unavailable');
      const json = await response.json();
      const result = json.routes?.[0], polyline = result?.polyline?.encodedPolyline;
      const durationSeconds = Number(String(result?.duration).replace(/s$/, ''));
      if (typeof polyline !== 'string' || !polyline || !Number.isFinite(result?.distanceMeters) || result.distanceMeters < 0 || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new Error('Invalid route');
      const coords = this.decode(polyline);
      if (coords.length < 2) throw new Error('Invalid geometry');
      return { line: `LINESTRING(${coords.map(([lat, lng]) => `${lng} ${lat}`).join(',')})`, polyline,
        distanceMeters: result.distanceMeters, durationSeconds, travelTimeMinutes: Math.ceil(durationSeconds / 60), provider: 'google-routes' };
    } catch { throw new BadGatewayException('Google chưa trả được tuyến hợp lệ. Vui lòng kiểm tra cấu hình hoặc thử lại sau.'); }
  }

  private decode(encoded: string): number[][] {
    let index = 0, lat = 0, lng = 0;
    const points: number[][] = [];
    const component = () => {
      let shift = 0, value = 0, byte: number;
      do {
        if (index >= encoded.length || shift > 30) throw new Error('Invalid polyline');
        byte = encoded.charCodeAt(index++) - 63;
        if (byte < 0 || byte > 63) throw new Error('Invalid polyline');
        value |= (byte & 31) << shift; shift += 5;
      } while (byte >= 32);
      return value & 1 ? ~(value >> 1) : value >> 1;
    };
    while (index < encoded.length) {
      lat += component(); lng += component();
      if (Math.abs(lat / 1e5) > 90 || Math.abs(lng / 1e5) > 180) throw new Error('Invalid coordinate');
      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }
}
