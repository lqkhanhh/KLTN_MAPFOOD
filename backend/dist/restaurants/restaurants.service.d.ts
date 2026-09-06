import { Repository } from 'typeorm';
import { Restaurant } from '../database/entities';
import { PublicRestaurantsQueryDto, RestaurantDto } from './dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
export declare class RestaurantsService {
    private readonly restaurants;
    constructor(restaurants: Repository<Restaurant>);
    findPublic(query: PublicRestaurantsQueryDto): Promise<{
        data: Restaurant[];
        total: number;
        page: number;
        limit: number;
    }>;
    findMine(user: AuthenticatedUser): Promise<Restaurant[]>;
    findOne(id: string): Promise<Restaurant>;
    create(dto: RestaurantDto, user: AuthenticatedUser): Promise<Restaurant>;
    update(id: string, dto: RestaurantDto, user: AuthenticatedUser): Promise<Restaurant>;
}
