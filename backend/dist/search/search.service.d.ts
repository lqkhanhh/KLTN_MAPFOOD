import { Repository } from 'typeorm';
import { Restaurant, RouteSearchLog } from '../database/entities';
import { RouteSearchDto } from './dto/route-search.dto';
export declare class SearchService {
    private readonly restaurants;
    private readonly logs;
    constructor(restaurants: Repository<Restaurant>, logs: Repository<RouteSearchLog>);
    route(dto: RouteSearchDto, userId?: string): Promise<{
        route: {
            polyline: string;
            provider: string;
            travelTimeMinutes: number;
        };
        radiusMeters: number;
        restaurants: any;
    }>;
    private directions;
    private decode;
    private estimateFallbackMinutes;
}
