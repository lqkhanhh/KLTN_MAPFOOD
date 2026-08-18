import { Order } from './order.entity';
export declare enum PaymentStatus {
    PENDING = "pending",
    PAID = "paid",
    FAILED = "failed",
    EXPIRED = "expired"
}
export declare class Payment {
    id: string;
    order: Order;
    orderId: string;
    transactionCode: string;
    provider: string;
    status: PaymentStatus;
    qrCode?: string;
    createdAt: Date;
}
