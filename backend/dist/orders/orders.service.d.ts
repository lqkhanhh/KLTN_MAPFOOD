import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Order, OrderPaymentStatus, OrderStatus, OrderPaymentMethod, PickupType } from '../database/entities';
import { CreateOrderDto, ListOrdersQueryDto } from './dto';
import { OrdersGateway } from './gateway/orders.gateway';
export declare const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>>;
export declare class OrdersService {
    private readonly dataSource;
    private readonly gateway;
    constructor(dataSource: DataSource, gateway: OrdersGateway);
    create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: OrderPaymentMethod;
        status: OrderStatus;
        paymentStatus: OrderPaymentStatus;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        customerName: string;
        customerPhone: string;
        note: string | undefined;
        items: {
            id: string;
            menuItemId: string | undefined;
            itemName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
            note: string | undefined;
        }[];
        payments: {
            id: string;
            provider: import("../database/entities").PaymentProvider;
            transactionId: string;
            amount: number;
            status: import("../database/entities").PaymentStatus;
            checkoutUrl: string | undefined;
            qrCode: string | undefined;
            paidAt: Date | undefined;
            createdAt: Date;
        }[];
        review: {
            id: string;
            rating: number;
            comment: string | undefined;
            createdAt: Date;
        } | null;
        statusUpdatedAt: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAllForUser(user: AuthenticatedUser, query: ListOrdersQueryDto): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: OrderPaymentMethod;
        status: OrderStatus;
        paymentStatus: OrderPaymentStatus;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        customerName: string;
        customerPhone: string;
        note: string | undefined;
        items: {
            id: string;
            menuItemId: string | undefined;
            itemName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
            note: string | undefined;
        }[];
        payments: {
            id: string;
            provider: import("../database/entities").PaymentProvider;
            transactionId: string;
            amount: number;
            status: import("../database/entities").PaymentStatus;
            checkoutUrl: string | undefined;
            qrCode: string | undefined;
            paidAt: Date | undefined;
            createdAt: Date;
        }[];
        review: {
            id: string;
            rating: number;
            comment: string | undefined;
            createdAt: Date;
        } | null;
        statusUpdatedAt: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOneForUser(id: string, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: OrderPaymentMethod;
        status: OrderStatus;
        paymentStatus: OrderPaymentStatus;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        customerName: string;
        customerPhone: string;
        note: string | undefined;
        items: {
            id: string;
            menuItemId: string | undefined;
            itemName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
            note: string | undefined;
        }[];
        payments: {
            id: string;
            provider: import("../database/entities").PaymentProvider;
            transactionId: string;
            amount: number;
            status: import("../database/entities").PaymentStatus;
            checkoutUrl: string | undefined;
            qrCode: string | undefined;
            paidAt: Date | undefined;
            createdAt: Date;
        }[];
        review: {
            id: string;
            rating: number;
            comment: string | undefined;
            createdAt: Date;
        } | null;
        statusUpdatedAt: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findEntityForUser(id: string, user: AuthenticatedUser): Promise<Order>;
    updateStatus(id: string, nextStatus: OrderStatus, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: OrderPaymentMethod;
        status: OrderStatus;
        paymentStatus: OrderPaymentStatus;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        customerName: string;
        customerPhone: string;
        note: string | undefined;
        items: {
            id: string;
            menuItemId: string | undefined;
            itemName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
            note: string | undefined;
        }[];
        payments: {
            id: string;
            provider: import("../database/entities").PaymentProvider;
            transactionId: string;
            amount: number;
            status: import("../database/entities").PaymentStatus;
            checkoutUrl: string | undefined;
            qrCode: string | undefined;
            paidAt: Date | undefined;
            createdAt: Date;
        }[];
        review: {
            id: string;
            rating: number;
            comment: string | undefined;
            createdAt: Date;
        } | null;
        statusUpdatedAt: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findEntity(id: string): Promise<Order>;
    toPublicOrder(order: Order): {
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: OrderPaymentMethod;
        status: OrderStatus;
        paymentStatus: OrderPaymentStatus;
        subtotal: number;
        discountAmount: number;
        totalAmount: number;
        customerName: string;
        customerPhone: string;
        note: string | undefined;
        items: {
            id: string;
            menuItemId: string | undefined;
            itemName: string;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
            note: string | undefined;
        }[];
        payments: {
            id: string;
            provider: import("../database/entities").PaymentProvider;
            transactionId: string;
            amount: number;
            status: import("../database/entities").PaymentStatus;
            checkoutUrl: string | undefined;
            qrCode: string | undefined;
            paidAt: Date | undefined;
            createdAt: Date;
        }[];
        review: {
            id: string;
            rating: number;
            comment: string | undefined;
            createdAt: Date;
        } | null;
        statusUpdatedAt: Date | undefined;
        createdAt: Date;
        updatedAt: Date;
    };
    private assertCanRead;
    private assertRestaurantOwner;
    private resolvePickupOption;
    private cleanOptionalText;
    private createOrderCode;
}
