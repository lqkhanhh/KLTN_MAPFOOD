import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RouteSearchDto } from './dto/route-search.dto';
import { SearchService } from './search.service';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    route(dto: RouteSearchDto, user?: AuthenticatedUser): Promise<{
        route: {
            polyline: string;
            provider: string;
            travelTimeMinutes: number;
        };
        radiusMeters: number;
        restaurants: any;
    }>;
    routeGet(dto: RouteSearchDto, user?: AuthenticatedUser): Promise<{
        route: {
            polyline: string;
            provider: string;
            travelTimeMinutes: number;
        };
        radiusMeters: number;
        restaurants: any;
    }>;
}
