import { User } from './user.entity';
import { MenuItem } from './menu-item.entity';
import { Review } from './review.entity';
export declare class Restaurant {
    id: string;
    name: string;
    address: string;
    location: object;
    openingHours: string;
    rating: number;
    reviewCount: number;
    owner: User;
    ownerId: string;
    menuItems: MenuItem[];
    reviews: Review[];
    createdAt: Date;
    updatedAt: Date;
}
