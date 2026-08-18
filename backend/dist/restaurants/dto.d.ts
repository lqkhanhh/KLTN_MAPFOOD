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
    latitude: number;
    longitude: number;
    openingHours: string;
    menuItems?: MenuItemDto[];
}
