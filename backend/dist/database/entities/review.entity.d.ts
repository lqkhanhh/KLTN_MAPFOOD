import { User } from './user.entity';
import { Restaurant } from './restaurant.entity';
export declare class Review {
    id: string;
    user: User;
    userId: string;
    restaurant: Restaurant;
    restaurantId: string;
    rating: number;
    comment?: string;
    createdAt: Date;
}
