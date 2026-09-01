import { PaymentProvider, PaymentStatus } from '../../database/entities';

export const PAYMENT_PROVIDER_ADAPTER = Symbol('PAYMENT_PROVIDER_ADAPTER');

export interface ProviderOrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CreateProviderPaymentRequest {
  transactionId: string;
  orderCode: string;
  amount: number;
  items: ProviderOrderItem[];
  expiresAt: Date;
}

export interface CreateProviderPaymentResult {
  paymentLinkId?: string;
  checkoutUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
  safePayload: Record<string, unknown>;
}

export interface VerifiedPaymentWebhook {
  transactionId: string;
  paymentLinkId?: string;
  amount: number;
  status: PaymentStatus;
  reference?: string;
  safePayload: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPayment(request: CreateProviderPaymentRequest): Promise<CreateProviderPaymentResult>;
  verifyWebhook(payload: unknown): Promise<VerifiedPaymentWebhook>;
}
