import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PaymentStatus } from '../database/entities';
import { OrdersGateway } from '../orders/gateway/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderAdapter } from './providers/payment-provider.interface';
export declare class PaymentsService {
    private readonly dataSource;
    private readonly ordersService;
    private readonly gateway;
    private readonly provider;
    private readonly logger;
    constructor(dataSource: DataSource, ordersService: OrdersService, gateway: OrdersGateway, provider: PaymentProviderAdapter);
    create(orderId: string, user: AuthenticatedUser): Promise<{
        paymentId: string;
        provider: import("../database/entities").PaymentProvider;
        transactionId: string;
        paymentLinkId: string | undefined;
        checkoutUrl: string | undefined;
        qrCode: string | undefined;
        amount: number;
        status: PaymentStatus;
        expiresAt: Date | undefined;
    }>;
    webhook(payload: unknown): Promise<{
        code: string;
        desc: string;
        ignored: boolean;
    }>;
    private markCreationFailed;
    private toOrderPaymentStatus;
    private createTransactionId;
    private toResponse;
}
