import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../../database/entities';
import { CreateProviderPaymentRequest, CreateProviderPaymentResult, PaymentProviderAdapter, VerifiedPaymentWebhook } from './payment-provider.interface';
export declare class VietQrProvider implements PaymentProviderAdapter {
    private readonly config;
    readonly provider = PaymentProvider.VIETQR;
    constructor(config: ConfigService);
    createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult>;
    verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook>;
    private mapStatus;
    private isWebhookPayload;
}
