import { SearchService } from './search.service';
import { RouteSearchDto } from './dto/route-search.dto';
export declare class SearchController {
    private service;
    constructor(service: SearchService);
    route(dto: RouteSearchDto, user: any): Promise<{
        route: {
            polyline: string;
            provider: string;
        };
        radiusMeters: number;
        restaurants: any;
    }>;
}
