import { User } from './user.entity';
import { MenuItem } from './menu-item.entity';
import { Review } from './review.entity';
import { Order } from './order.entity';
export declare class Restaurant {
    id: string;
    name: string;
    address: string;
    category?: string;
    imageUrl?: string;
    location: object;
    openingHours: string;
    active: boolean;
    source: string;
    suspendedReason?: string;
    suspendedAt?: Date;
    rating: number;
    reviewCount: number;
    owner: User;
    ownerId: string;
    menuItems: MenuItem[];
    orders: Order[];
    reviews: Review[];
    createdAt: Date;
    updatedAt: Date;
}
