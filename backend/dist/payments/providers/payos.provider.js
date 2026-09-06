"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayOSProvider = void 0;
const common_1 = require("@nestjs/common");
const node_1 = require("@payos/node");
const entities_1 = require("../../database/entities");
class PayOSProvider {
    constructor(config) {
        this.config = config;
        this.provider = entities_1.PaymentProvider.PAYOS;
        this.client = new node_1.PayOS({
            clientId: config.getOrThrow('PAYOS_CLIENT_ID'),
            apiKey: config.getOrThrow('PAYOS_API_KEY'),
            checksumKey: config.getOrThrow('PAYOS_CHECKSUM_KEY'),
        });
    }
    async createPayment(request) {
        const result = await this.client.paymentRequests.create({
            orderCode: Number(request.transactionId),
            amount: request.amount,
            description: `RouteBite ${request.orderCode.slice(-12)}`,
            items: request.items,
            returnUrl: this.config.getOrThrow('PAYOS_RETURN_URL'),
            cancelUrl: this.config.getOrThrow('PAYOS_CANCEL_URL'),
            expiredAt: Math.floor(request.expiresAt.getTime() / 1000),
        });
        return {
            paymentLinkId: result.paymentLinkId,
            checkoutUrl: result.checkoutUrl,
            qrCode: result.qrCode,
            expiresAt: result.expiredAt ? new Date(result.expiredAt * 1000) : request.expiresAt,
            safePayload: {
                currency: result.currency,
                status: result.status,
                description: result.description,
                expiredAt: result.expiredAt,
            },
        };
    }
    async verifyWebhook(payload) {
        try {
            const verified = await this.client.webhooks.verify(payload);
            return {
                transactionId: String(verified.orderCode),
                paymentLinkId: verified.paymentLinkId,
                amount: Number(verified.amount),
                status: verified.code === '00' ? entities_1.PaymentStatus.PAID : entities_1.PaymentStatus.FAILED,
                reference: verified.reference,
                safePayload: {
                    code: verified.code,
                    currency: verified.currency,
                    reference: verified.reference,
                    transactionDateTime: verified.transactionDateTime,
                },
            };
        }
        catch {
            throw new common_1.BadRequestException('Chữ ký webhook PayOS không hợp lệ');
        }
    }
}
exports.PayOSProvider = PayOSProvider;
//# sourceMappingURL=payos.provider.js.map