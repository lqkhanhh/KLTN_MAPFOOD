import { User } from './user.entity';
import { Restaurant } from './restaurant.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';
import { Review } from './review.entity';
export declare enum PickupType {
    ASAP = "asap",
    SCHEDULED = "scheduled"
}
export declare enum OrderPaymentMethod {
    CASH = "cash",
    VNPAY = "vnpay"
}
export declare enum OrderStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PREPARING = "PREPARING",
    READY = "READY",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export declare enum OrderPaymentStatus {
    UNPAID = "UNPAID",
    PENDING = "PENDING",
    PAID = "PAID",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    REFUNDED = "REFUNDED"
}
export declare class Order {
    id: string;
    orderCode: string;
    user: User;
    userId: string;
    restaurant: Restaurant;
    restaurantId: string;
    pickupType: PickupType;
    estimatedPickupMinutes?: number;
    scheduledPickupTime?: Date;
    estimatedPickupAt: Date;
    paymentMethod: OrderPaymentMethod;
    status: OrderStatus;
    paymentStatus: OrderPaymentStatus;
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
    customerName: string;
    customerPhone: string;
    note?: string;
    statusUpdatedById?: string;
    statusUpdatedBy?: User;
    statusUpdatedAt?: Date;
    items: OrderItem[];
    payments: Payment[];
    review?: Review;
    createdAt: Date;
    updatedAt: Date;
}
