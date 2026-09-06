export declare class PaymentWebhookDto {
    code?: string;
    desc?: string;
    success?: boolean;
    data?: Record<string, unknown>;
    signature: string;
    transactionId?: string;
    orderCode?: string;
    amount?: number;
    status?: string;
    reference?: string;
}
