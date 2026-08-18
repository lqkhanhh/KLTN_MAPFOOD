import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentWebhookDto } from './dto';
export declare class PaymentsController {
    private service;
    constructor(service: PaymentsService);
    create(dto: CreatePaymentDto): Promise<{
        paymentId: string;
        transactionCode: string;
        qrCode: string | undefined;
        expiresIn: number;
        amount: number;
    }>;
    webhook(dto: PaymentWebhookDto): Promise<import("../database/entities").Order>;
}
