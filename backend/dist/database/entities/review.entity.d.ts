import { User } from './user.entity';
import { Restaurant } from './restaurant.entity';
import { Order } from './order.entity';
export declare class Review {
    id: string;
    order: Order;
    orderId: string;
    user: User;
    userId: string;
    restaurant: Restaurant;
    restaurantId: string;
    rating: number;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
}
