import { OrderPaymentMethod, PickupType } from '../../database/entities';
export declare class CreateOrderItemDto {
    menuItemId: string;
    quantity: number;
    note?: string;
}
export declare class PickupOptionDto {
    type: PickupType;
    estimatedPickupMinutes?: number;
    scheduledTime?: string;
}
export declare class PaymentOptionDto {
    method: OrderPaymentMethod;
}
export declare class CreateOrderDto {
    restaurantId: string;
    pickupOption: PickupOptionDto;
    payment: PaymentOptionDto;
    note?: string;
    items?: CreateOrderItemDto[];
}
