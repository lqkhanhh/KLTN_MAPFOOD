"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VnpayProvider = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const entities_1 = require("../../database/entities");
class VnpayProvider {
    constructor(config) {
        this.config = config;
        this.provider = entities_1.PaymentProvider.VNPAY;
    }
    async createPayment(request) {
        const now = new Date();
        const params = {
            vnp_Amount: String(request.amount * 100),
            vnp_Command: 'pay',
            vnp_CreateDate: this.formatDate(now),
            vnp_CurrCode: 'VND',
            vnp_IpAddr: '127.0.0.1',
            vnp_Locale: 'vn',
            vnp_OrderInfo: request.orderCode,
            vnp_OrderType: 'other',
            vnp_ReturnUrl: this.config.getOrThrow('VNPAY_RETURN_URL'),
            vnp_TmnCode: this.config.getOrThrow('VNPAY_TMN_CODE'),
            vnp_TxnRef: request.transactionId,
            vnp_Version: '2.1.0',
        };
        const query = this.sign(params);
        return {
            checkoutUrl: `${this.config.get('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')}?${query}`,
            expiresAt: request.expiresAt,
            safePayload: { orderCode: request.orderCode, transactionId: request.transactionId },
        };
    }
    async verifyWebhook(payload) {
        if (!payload || typeof payload !== 'object')
            throw new common_1.BadRequestException('Dữ liệu VNPAY không hợp lệ');
        const value = Object.fromEntries(Object.entries(payload).filter(([, item]) => typeof item === 'string'));
        const received = value.vnp_SecureHash;
        if (!received)
            throw new common_1.BadRequestException('Thiếu chữ ký VNPAY');
        const unsigned = { ...value };
        delete unsigned.vnp_SecureHash;
        delete unsigned.vnp_SecureHashType;
        const expected = (0, crypto_1.createHmac)('sha512', this.config.getOrThrow('VNPAY_HASH_SECRET'))
            .update(this.canonical(unsigned), 'utf8').digest('hex');
        const actualBuffer = Buffer.from(received, 'utf8');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        if (actualBuffer.length !== expectedBuffer.length || !(0, crypto_1.timingSafeEqual)(actualBuffer, expectedBuffer)) {
            throw new common_1.BadRequestException('Chữ ký VNPAY không hợp lệ');
        }
        const amount = Number(value.vnp_Amount) / 100;
        if (!value.vnp_TxnRef || !Number.isInteger(amount) || amount <= 0) {
            throw new common_1.BadRequestException('Dữ liệu giao dịch VNPAY không hợp lệ');
        }
        return {
            transactionId: value.vnp_TxnRef,
            amount,
            status: value.vnp_ResponseCode === '00' ? entities_1.PaymentStatus.PAID : entities_1.PaymentStatus.FAILED,
            reference: value.vnp_TransactionNo,
            safePayload: { orderCode: value.vnp_OrderInfo, responseCode: value.vnp_ResponseCode, transactionNo: value.vnp_TransactionNo },
        };
    }
    sign(params) {
        const canonical = this.canonical(params);
        const secureHash = (0, crypto_1.createHmac)('sha512', this.config.getOrThrow('VNPAY_HASH_SECRET')).update(canonical, 'utf8').digest('hex');
        return `${canonical}&vnp_SecureHash=${secureHash}`;
    }
    canonical(params) {
        return Object.keys(params).sort().map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`).join('&');
    }
    formatDate(value) {
        const pad = (number) => String(number).padStart(2, '0');
        return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
    }
}
exports.VnpayProvider = VnpayProvider;
//# sourceMappingURL=vnpay.provider.js.map