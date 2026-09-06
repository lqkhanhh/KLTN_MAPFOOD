import { UserRole } from '../../database/entities';
export declare class PageQueryDto {
    page: number;
    limit: number;
}
export declare class AdminRestaurantQueryDto extends PageQueryDto {
    active?: boolean;
    source?: string;
    search?: string;
}
export declare class AdminUserQueryDto extends PageQueryDto {
    role?: UserRole;
    search?: string;
}
