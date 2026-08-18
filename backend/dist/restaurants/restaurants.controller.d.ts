import { RestaurantsService } from './restaurants.service';
import { RestaurantDto } from './dto';
export declare class RestaurantsController {
    private service;
    constructor(service: RestaurantsService);
    findOne(id: string): Promise<import("../database/entities").Restaurant>;
    create(dto: RestaurantDto, user: any): Promise<import("../database/entities").Restaurant>;
    update(id: string, dto: RestaurantDto, user: any): Promise<import("../database/entities").Restaurant>;
}
