import { Repository } from 'typeorm';
import { Restaurant, RouteSearchLog } from '../database/entities';
import { RouteSearchDto } from './dto/route-search.dto';
export declare class SearchService {
    private restaurants;
    private logs;
    constructor(restaurants: Repository<Restaurant>, logs: Repository<RouteSearchLog>);
    route(dto: RouteSearchDto, userId?: string): Promise<{
        route: {
            polyline: string;
            provider: string;
        };
        radiusMeters: number;
        restaurants: any;
    }>;
}
