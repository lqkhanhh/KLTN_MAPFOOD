import { Repository } from 'typeorm';
import { Order, Restaurant, RouteSearchLog, User } from '../database/entities';
import { AdminRestaurantQueryDto, AdminUserQueryDto } from './dto';
export declare class AdminService {
    private readonly usersRepo;
    private readonly restaurantsRepo;
    private readonly ordersRepo;
    private readonly routesRepo;
    constructor(usersRepo: Repository<User>, restaurantsRepo: Repository<Restaurant>, ordersRepo: Repository<Order>, routesRepo: Repository<RouteSearchLog>);
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
        data: Restaurant[];
        page: number;
        limit: number;
        total: number;
    }>;
    users(query: AdminUserQueryDto): Promise<{
        data: User[];
        page: number;
        limit: number;
        total: number;
    }>;
    suspend(id: string, reason: string): Promise<Restaurant>;
    activate(id: string): Promise<Restaurant>;
}
