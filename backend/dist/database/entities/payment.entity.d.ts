import { Order } from './order.entity';
export declare enum PaymentProvider {
    PAYOS = "PAYOS",
    VIETQR = "VIETQR",
    VNPAY = "VNPAY"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    PAID = "PAID",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    REFUNDED = "REFUNDED"
}
export declare class Payment {
    id: string;
    order: Order;
    orderId: string;
    provider: PaymentProvider;
    transactionId: string;
    paymentLinkId?: string;
    amount: number;
    status: PaymentStatus;
    checkoutUrl?: string;
    qrCode?: string;
    providerPayload?: Record<string, unknown>;
    expiresAt?: Date;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
