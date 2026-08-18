import { OrderStatus, OrderType } from '../database/entities/order.entity';
export declare class OrderItemDto {
    menuItemId: string;
    quantity: number;
}
export declare class CreateOrderDto {
    restaurantId: string;
    type: OrderType;
    pickupAt: string;
    items: OrderItemDto[];
}
export declare class UpdateOrderStatusDto {
    status: OrderStatus;
}
