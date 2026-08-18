import { Restaurant } from './restaurant.entity';
export declare class MenuItem {
    id: string;
    name: string;
    price: number;
    description?: string;
    available: boolean;
    restaurant: Restaurant;
    restaurantId: string;
}
