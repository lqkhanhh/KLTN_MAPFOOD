import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../../database/entities';
import { CreateProviderPaymentRequest, CreateProviderPaymentResult, PaymentProviderAdapter, VerifiedPaymentWebhook } from './payment-provider.interface';
export declare class PayOSProvider implements PaymentProviderAdapter {
    private readonly config;
    readonly provider = PaymentProvider.PAYOS;
    private readonly client;
    constructor(config: ConfigService);
    createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult>;
    verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook>;
}
