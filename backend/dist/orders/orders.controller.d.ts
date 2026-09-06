import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto';
import { OrdersService } from './orders.service';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: import("../database/entities").PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: import("../database/entities").OrderPaymentMethod;
        status: import("../database/entities").OrderStatus;
        paymentStatus: import("../database/entities").OrderPaymentStatus;
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
    findAll(user: AuthenticatedUser, query: ListOrdersQueryDto): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: import("../database/entities").PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: import("../database/entities").OrderPaymentMethod;
        status: import("../database/entities").OrderStatus;
        paymentStatus: import("../database/entities").OrderPaymentStatus;
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
    findOne(id: string, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: import("../database/entities").PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: import("../database/entities").OrderPaymentMethod;
        status: import("../database/entities").OrderStatus;
        paymentStatus: import("../database/entities").OrderPaymentStatus;
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
    updateStatus(id: string, dto: UpdateOrderStatusDto, user: AuthenticatedUser): Promise<{
        id: string;
        orderCode: string;
        userId: string;
        restaurant: {
            id: string;
            name: string;
            address: string;
        };
        pickupType: import("../database/entities").PickupType;
        estimatedPickupMinutes: number | undefined;
        scheduledPickupTime: Date | undefined;
        estimatedPickupAt: Date;
        paymentMethod: import("../database/entities").OrderPaymentMethod;
        status: import("../database/entities").OrderStatus;
        paymentStatus: import("../database/entities").OrderPaymentStatus;
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
}
