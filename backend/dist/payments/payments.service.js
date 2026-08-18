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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const orders_service_1 = require("../orders/orders.service");
let PaymentsService = class PaymentsService {
    constructor(payments, orders, orderService) {
        this.payments = payments;
        this.orders = orders;
        this.orderService = orderService;
    }
    async create(orderId) { const order = await this.orders.findOneBy({ id: orderId }); if (!order)
        throw new common_1.NotFoundException('Không tìm thấy đơn'); const transactionCode = `PAY-${order.code}`; let payment = await this.payments.findOneBy({ orderId }); if (!payment)
        payment = await this.payments.save(this.payments.create({ orderId, transactionCode, provider: process.env.PAYOS_CLIENT_ID ? 'payos' : 'vietqr-demo', qrCode: this.qr(order, transactionCode) })); return { paymentId: payment.id, transactionCode, qrCode: payment.qrCode, expiresIn: 300, amount: order.totalAmount }; }
    async webhook(orderCode, status) { const order = await this.orders.findOneBy({ code: orderCode }); if (!order)
        throw new common_1.NotFoundException('Không tìm thấy đơn'); const payment = await this.payments.findOneBy({ orderId: order.id }); if (payment) {
        payment.status = status.toUpperCase() === 'PAID' ? entities_1.PaymentStatus.PAID : entities_1.PaymentStatus.FAILED;
        await this.payments.save(payment);
    } if (status.toUpperCase() === 'PAID' && order.status === entities_1.OrderStatus.PENDING_PAYMENT)
        return this.orderService.status(order.id, entities_1.OrderStatus.PAID); return order; }
    qr(order, code) { return `https://img.vietqr.io/image/970422-0000000000-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(code)}&accountName=ROUTEBITE`; }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Payment)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, orders_service_1.OrdersService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map