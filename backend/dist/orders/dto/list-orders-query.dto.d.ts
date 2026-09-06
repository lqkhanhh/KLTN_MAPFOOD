import { OrderStatus } from '../../database/entities';
export declare class ListOrdersQueryDto {
    restaurantId?: string;
    status?: OrderStatus;
}
