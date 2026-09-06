"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const entities_1 = require("../database/entities");
const orders_gateway_1 = require("../orders/gateway/orders.gateway");
const orders_service_1 = require("../orders/orders.service");
const payment_provider_interface_1 = require("./providers/payment-provider.interface");
const PAYMENT_STATUS_TRANSITIONS = {
    [entities_1.PaymentStatus.PENDING]: [
        entities_1.PaymentStatus.PAID,
        entities_1.PaymentStatus.FAILED,
        entities_1.PaymentStatus.CANCELLED,
        entities_1.PaymentStatus.EXPIRED,
    ],
    [entities_1.PaymentStatus.FAILED]: [entities_1.PaymentStatus.PAID],
    [entities_1.PaymentStatus.CANCELLED]: [entities_1.PaymentStatus.PAID],
    [entities_1.PaymentStatus.EXPIRED]: [entities_1.PaymentStatus.PAID],
    [entities_1.PaymentStatus.PAID]: [entities_1.PaymentStatus.REFUNDED],
    [entities_1.PaymentStatus.REFUNDED]: [],
};
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(dataSource, ordersService, gateway, provider) {
        this.dataSource = dataSource;
        this.ordersService = ordersService;
        this.gateway = gateway;
        this.provider = provider;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async create(orderId, user) {
        const accessibleOrder = await this.ordersService.findEntityForUser(orderId, user);
        if (user.role !== entities_1.UserRole.ADMIN && accessibleOrder.userId !== user.sub) {
            throw new common_1.ForbiddenException('Chỉ khách đặt đơn mới có thể tạo thanh toán');
        }
        const reservation = await this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(entities_1.Order, {
                where: { id: orderId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!order)
                throw new common_1.BadRequestException('Không tìm thấy đơn hàng');
            if ([entities_1.OrderStatus.CANCELLED, entities_1.OrderStatus.COMPLETED].includes(order.status)) {
                throw new common_1.ConflictException('Không thể thanh toán đơn đã hủy hoặc hoàn tất');
            }
            if (order.paymentStatus === entities_1.OrderPaymentStatus.PAID) {
                throw new common_1.ConflictException('Đơn hàng đã được thanh toán');
            }
            if (order.paymentMethod !== entities_1.OrderPaymentMethod.VNPAY) {
                throw new common_1.ConflictException('Đơn tiền mặt không cần tạo giao dịch VNPAY');
            }
            if (order.totalAmount <= 0) {
                throw new common_1.ConflictException('Đơn hàng không có số tiền cần thanh toán');
            }
            let payment = await manager.findOne(entities_1.Payment, {
                where: { orderId },
                lock: { mode: 'pessimistic_write' },
            });
            if (payment?.status === entities_1.PaymentStatus.PAID) {
                throw new common_1.ConflictException('Đơn hàng đã được thanh toán');
            }
            if (payment?.status === entities_1.PaymentStatus.PENDING &&
                (!payment.expiresAt || payment.expiresAt.getTime() > Date.now())) {
                if (!payment.qrCode && !payment.checkoutUrl) {
                    throw new common_1.ConflictException('Giao dịch đang được khởi tạo, vui lòng thử lại sau');
                }
                return { payment, shouldCreateAtProvider: false, order, items: [] };
            }
            const transactionId = this.createTransactionId();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            const items = await manager.find(entities_1.OrderItem, { where: { orderId } });
            if (payment) {
                Object.assign(payment, {
                    provider: this.provider.provider,
                    transactionId,
                    paymentLinkId: undefined,
                    amount: order.totalAmount,
                    status: entities_1.PaymentStatus.PENDING,
                    checkoutUrl: undefined,
                    qrCode: undefined,
                    providerPayload: { creationState: 'CREATING' },
                    expiresAt,
                    paidAt: undefined,
                });
            }
            else {
                payment = manager.create(entities_1.Payment, {
                    orderId,
                    provider: this.provider.provider,
                    transactionId,
                    amount: order.totalAmount,
                    status: entities_1.PaymentStatus.PENDING,
                    providerPayload: { creationState: 'CREATING' },
                    expiresAt,
                });
            }
            payment = await manager.save(entities_1.Payment, payment);
            order.paymentStatus = entities_1.OrderPaymentStatus.PENDING;
            await manager.save(entities_1.Order, order);
            return { payment, shouldCreateAtProvider: true, order, items };
        });
        if (!reservation.shouldCreateAtProvider)
            return this.toResponse(reservation.payment);
        try {
            const result = await this.provider.createPayment({
                transactionId: reservation.payment.transactionId,
                orderCode: reservation.order.orderCode,
                amount: reservation.order.totalAmount,
                items: reservation.items.map((item) => ({
                    name: item.itemName,
                    quantity: item.quantity,
                    price: item.unitPrice,
                })),
                expiresAt: reservation.payment.expiresAt,
            });
            const payment = await this.dataSource.transaction(async (manager) => {
                const current = await manager.findOneOrFail(entities_1.Payment, {
                    where: { id: reservation.payment.id },
                    lock: { mode: 'pessimistic_write' },
                });
                if (current.transactionId !== reservation.payment.transactionId) {
                    throw new common_1.ConflictException('Giao dịch đã được thay thế bởi một lần thử mới');
                }
                current.paymentLinkId = result.paymentLinkId;
                current.checkoutUrl = result.checkoutUrl;
                current.qrCode = result.qrCode;
                current.expiresAt = result.expiresAt ?? current.expiresAt;
                current.providerPayload = result.safePayload;
                return manager.save(entities_1.Payment, current);
            });
            return this.toResponse(payment);
        }
        catch (error) {
            await this.markCreationFailed(reservation.payment.id, reservation.payment.transactionId);
            if (error instanceof common_1.ConflictException)
                throw error;
            const message = error instanceof Error ? error.message : 'Provider unavailable';
            this.logger.error(`payment.create.failed paymentId=${reservation.payment.id} provider=${this.provider.provider}`);
            throw new common_1.BadGatewayException(`Không thể tạo giao dịch: ${message}`);
        }
    }
    async webhook(payload) {
        const verified = await this.provider.verifyWebhook(payload);
        const result = await this.dataSource.transaction(async (manager) => {
            const candidate = await manager.findOne(entities_1.Payment, {
                where: { provider: this.provider.provider, transactionId: verified.transactionId },
            });
            if (!candidate)
                return { changed: false, ignored: true };
            const order = await manager.findOne(entities_1.Order, {
                where: { id: candidate.orderId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!order)
                throw new common_1.BadRequestException('Không tìm thấy đơn hàng của giao dịch');
            const payment = await manager.findOne(entities_1.Payment, {
                where: {
                    id: candidate.id,
                    provider: this.provider.provider,
                    transactionId: verified.transactionId,
                },
                lock: { mode: 'pessimistic_write' },
            });
            if (!payment)
                return { changed: false, ignored: true };
            if (payment.amount !== verified.amount) {
                throw new common_1.BadRequestException('Số tiền webhook không khớp giao dịch');
            }
            if (verified.paymentLinkId &&
                payment.paymentLinkId &&
                verified.paymentLinkId !== payment.paymentLinkId) {
                throw new common_1.BadRequestException('Payment link trong webhook không khớp');
            }
            const webhookOrderCode = verified.safePayload.orderCode;
            if (typeof webhookOrderCode === 'string' &&
                webhookOrderCode !== order.orderCode) {
                throw new common_1.BadRequestException('Mã đơn hàng trong webhook không khớp');
            }
            const isDuplicate = payment.status === verified.status &&
                order.paymentStatus === this.toOrderPaymentStatus(verified.status);
            if (isDuplicate)
                return { changed: false, ignored: false, orderId: order.id };
            if (!PAYMENT_STATUS_TRANSITIONS[payment.status].includes(verified.status)) {
                this.logger.warn(`payment.webhook.stale paymentId=${payment.id} current=${payment.status} received=${verified.status}`);
                return { changed: false, ignored: true, orderId: order.id };
            }
            payment.status = verified.status;
            payment.paymentLinkId = verified.paymentLinkId ?? payment.paymentLinkId;
            payment.providerPayload = {
                ...(payment.providerPayload ?? {}),
                webhook: verified.safePayload,
            };
            if (verified.status === entities_1.PaymentStatus.PAID)
                payment.paidAt = payment.paidAt ?? new Date();
            order.paymentStatus = this.toOrderPaymentStatus(verified.status);
            await manager.save(entities_1.Payment, payment);
            await manager.save(entities_1.Order, order);
            return { changed: true, ignored: false, orderId: order.id };
        });
        if ('orderId' in result && result.orderId && result.changed) {
            const order = await this.ordersService.findEntity(result.orderId);
            this.gateway.emitPaymentStatusUpdated(order, verified.status);
            if (verified.status === entities_1.PaymentStatus.PAID)
                this.gateway.emitCreated(order);
            this.logger.log(`payment.webhook.updated orderId=${order.id} status=${verified.status} provider=${this.provider.provider}`);
        }
        return { code: '00', desc: 'success', ignored: result.ignored };
    }
    async markCreationFailed(paymentId, transactionId) {
        await this.dataSource.transaction(async (manager) => {
            const candidate = await manager.findOne(entities_1.Payment, {
                where: { id: paymentId, transactionId },
            });
            if (!candidate)
                return;
            const order = await manager.findOne(entities_1.Order, {
                where: { id: candidate.orderId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!order)
                return;
            const payment = await manager.findOne(entities_1.Payment, {
                where: { id: paymentId, transactionId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!payment || payment.status !== entities_1.PaymentStatus.PENDING)
                return;
            payment.status = entities_1.PaymentStatus.FAILED;
            payment.providerPayload = { creationState: 'FAILED' };
            order.paymentStatus = entities_1.OrderPaymentStatus.FAILED;
            await manager.save(entities_1.Payment, payment);
            await manager.save(entities_1.Order, order);
        });
    }
    toOrderPaymentStatus(status) {
        return entities_1.OrderPaymentStatus[status];
    }
    createTransactionId() {
        return `${Date.now()}${(0, crypto_1.randomInt)(0, 1000).toString().padStart(3, '0')}`;
    }
    toResponse(payment) {
        return {
            paymentId: payment.id,
            provider: payment.provider,
            transactionId: payment.transactionId,
            paymentLinkId: payment.paymentLinkId,
            checkoutUrl: payment.checkoutUrl,
            qrCode: payment.qrCode,
            amount: payment.amount,
            status: payment.status,
            expiresAt: payment.expiresAt,
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(payment_provider_interface_1.PAYMENT_PROVIDER_ADAPTER)),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        orders_service_1.OrdersService,
        orders_gateway_1.OrdersGateway, Object])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map