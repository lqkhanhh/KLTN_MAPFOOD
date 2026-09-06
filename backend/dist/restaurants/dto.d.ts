export declare class PublicRestaurantsQueryDto {
    category?: string;
    search?: string;
    page: number;
    limit: number;
}
export declare class MenuItemDto {
    id?: string;
    name: string;
    price: number;
    description?: string;
    available?: boolean;
}
export declare class RestaurantDto {
    name: string;
    address: string;
    category?: string;
    imageUrl?: string;
    latitude: number;
    longitude: number;
    openingHours: string;
    active?: boolean;
    menuItems?: MenuItemDto[];
}
