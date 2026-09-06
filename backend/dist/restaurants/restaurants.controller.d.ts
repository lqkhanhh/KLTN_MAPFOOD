import { RestaurantsService } from './restaurants.service';
import { PublicRestaurantsQueryDto, RestaurantDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
export declare class RestaurantsController {
    private readonly service;
    constructor(service: RestaurantsService);
    findPublic(query: PublicRestaurantsQueryDto): Promise<{
        data: import("../database/entities").Restaurant[];
        total: number;
        page: number;
        limit: number;
    }>;
    findMine(user: AuthenticatedUser): Promise<import("../database/entities").Restaurant[]>;
    findOne(id: string): Promise<import("../database/entities").Restaurant>;
    create(dto: RestaurantDto, user: AuthenticatedUser): Promise<import("../database/entities").Restaurant>;
    update(id: string, dto: RestaurantDto, user: AuthenticatedUser): Promise<import("../database/entities").Restaurant>;
}
