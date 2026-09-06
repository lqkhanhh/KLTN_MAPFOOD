import { Restaurant } from './restaurant.entity';
import { Order } from './order.entity';
import { Review } from './review.entity';
export declare enum UserRole {
    CUSTOMER = "customer",
    MERCHANT = "merchant",
    ADMIN = "admin"
}
export declare class User {
    id: string;
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
    role: UserRole;
    refreshTokenHash?: string;
    restaurants: Restaurant[];
    orders: Order[];
    reviews: Review[];
    createdAt: Date;
    updatedAt: Date;
}
