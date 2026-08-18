import { User } from './user.entity';
import { Restaurant } from './restaurant.entity';
import { OrderItem } from './order-item.entity';
export declare enum OrderType {
    BOOKING = "booking",
    TAKE_AWAY = "take-away"
}
export declare enum OrderStatus {
    PENDING_PAYMENT = "pending_payment",
    PAID = "paid",
    CONFIRMED = "confirmed",
    PREPARING = "preparing",
    READY = "ready",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare class Order {
    id: string;
    code: string;
    type: OrderType;
    status: OrderStatus;
    totalAmount: number;
    pickupAt?: Date;
    customer: User;
    customerId: string;
    restaurant: Restaurant;
    restaurantId: string;
    items: OrderItem[];
    createdAt: Date;
    updatedAt: Date;
}
