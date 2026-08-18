import { Repository } from 'typeorm';
import { Restaurant } from '../database/entities';
import { RestaurantDto } from './dto';
export declare class RestaurantsService {
    private repo;
    constructor(repo: Repository<Restaurant>);
    findOne(id: string): Promise<Restaurant>;
    create(dto: RestaurantDto, user: any): Promise<Restaurant>;
    update(id: string, dto: RestaurantDto, user: any): Promise<Restaurant>;
}
