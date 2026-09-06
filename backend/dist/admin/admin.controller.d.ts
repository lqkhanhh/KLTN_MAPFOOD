import { AdminService } from './admin.service';
import { AdminRestaurantQueryDto, AdminUserQueryDto, SuspendRestaurantDto } from './dto';
export declare class AdminController {
    private readonly service;
    constructor(service: AdminService);
    overview(): Promise<{
        usersByRole: {
            role: any;
            count: number;
        }[];
        totalRestaurants: number;
        totalOrders: number;
        gmv: number;
        newUsersThisMonth: number;
        topRestaurants: any[];
    }>;
    searchAnalytics(): Promise<{
        totalSearches: number;
        popularOriginAreas: {
            latitude: number;
            longitude: number;
            count: number;
        }[];
        note: string;
    }>;
    restaurants(query: AdminRestaurantQueryDto): Promise<{
        data: import("../database/entities").Restaurant[];
        page: number;
        limit: number;
        total: number;
    }>;
    users(query: AdminUserQueryDto): Promise<{
        data: import("../database/entities").User[];
        page: number;
        limit: number;
        total: number;
    }>;
    suspend(id: string, dto: SuspendRestaurantDto): Promise<import("../database/entities").Restaurant>;
    activate(id: string): Promise<import("../database/entities").Restaurant>;
}
