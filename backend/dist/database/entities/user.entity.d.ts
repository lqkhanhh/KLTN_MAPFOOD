import { Restaurant } from './restaurant.entity';
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
    role: UserRole;
    refreshTokenHash?: string;
    restaurants: Restaurant[];
    createdAt: Date;
    updatedAt: Date;
}
