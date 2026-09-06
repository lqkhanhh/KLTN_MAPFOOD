import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreatePaymentDto, PaymentWebhookDto } from './dto';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    create(dto: CreatePaymentDto, user: AuthenticatedUser): Promise<{
        paymentId: string;
        provider: import("../database/entities").PaymentProvider;
        transactionId: string;
        paymentLinkId: string | undefined;
        checkoutUrl: string | undefined;
        qrCode: string | undefined;
        amount: number;
        status: import("../database/entities").PaymentStatus;
        expiresAt: Date | undefined;
    }>;
    webhook(dto: PaymentWebhookDto): Promise<{
        code: string;
        desc: string;
        ignored: boolean;
    }>;
    vnpayReturn(query: Record<string, string>): Promise<{
        code: string;
        desc: string;
        ignored: boolean;
    }>;
    vnpayIpn(payload: Record<string, string>): Promise<{
        code: string;
        desc: string;
        ignored: boolean;
    }>;
}
