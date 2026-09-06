"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VietQrProvider = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const entities_1 = require("../../database/entities");
class VietQrProvider {
    constructor(config) {
        this.config = config;
        this.provider = entities_1.PaymentProvider.VIETQR;
    }
    async createPayment(request) {
        const bin = this.config.getOrThrow('VIETQR_BANK_BIN');
        const account = this.config.getOrThrow('VIETQR_ACCOUNT_NUMBER');
        const accountName = this.config.getOrThrow('VIETQR_ACCOUNT_NAME');
        const query = new URLSearchParams({
            amount: String(request.amount),
            addInfo: request.transactionId,
            accountName,
        });
        return {
            qrCode: `https://img.vietqr.io/image/${bin}-${account}-compact2.png?${query}`,
            expiresAt: request.expiresAt,
            safePayload: { mode: 'LOCAL_VIETQR', bankBin: bin, expiresAt: request.expiresAt.toISOString() },
        };
    }
    async verifyWebhook(payload) {
        if (!this.isWebhookPayload(payload)) {
            throw new common_1.BadRequestException('Webhook VietQR local không đúng định dạng');
        }
        const secret = this.config.getOrThrow('PAYMENTS_DEMO_WEBHOOK_SECRET');
        const canonical = [
            payload.transactionId,
            payload.orderCode,
            payload.amount,
            payload.status.toUpperCase(),
        ].join('|');
        const expected = (0, crypto_1.createHmac)('sha256', secret).update(canonical).digest('hex');
        const receivedBuffer = Buffer.from(payload.signature, 'utf8');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        if (receivedBuffer.length !== expectedBuffer.length ||
            !(0, crypto_1.timingSafeEqual)(receivedBuffer, expectedBuffer)) {
            throw new common_1.BadRequestException('Chữ ký webhook VietQR local không hợp lệ');
        }
        return {
            transactionId: payload.transactionId,
            amount: payload.amount,
            status: this.mapStatus(payload.status),
            reference: payload.reference,
            safePayload: {
                orderCode: payload.orderCode,
                status: payload.status.toUpperCase(),
                reference: payload.reference,
            },
        };
    }
    mapStatus(status) {
        const normalized = status.toUpperCase();
        if (!Object.values(entities_1.PaymentStatus).includes(normalized)) {
            throw new common_1.BadRequestException('Trạng thái webhook VietQR local không hợp lệ');
        }
        return normalized;
    }
    isWebhookPayload(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        const value = payload;
        return (typeof value.transactionId === 'string' &&
            typeof value.orderCode === 'string' &&
            typeof value.amount === 'number' &&
            typeof value.status === 'string' &&
            typeof value.signature === 'string');
    }
}
exports.VietQrProvider = VietQrProvider;
//# sourceMappingURL=vietqr.provider.js.map