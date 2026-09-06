import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../../database/entities';
import { CreateProviderPaymentRequest, CreateProviderPaymentResult, PaymentProviderAdapter, VerifiedPaymentWebhook } from './payment-provider.interface';
export declare class VnpayProvider implements PaymentProviderAdapter {
    private readonly config;
    readonly provider = PaymentProvider.VNPAY;
    constructor(config: ConfigService);
    createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult>;
    verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook>;
    private sign;
    private canonical;
    private formatDate;
}
