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
exports.OrdersGateway = void 0;
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const websockets_1 = require("@nestjs/websockets");
const typeorm_2 = require("typeorm");
const socket_io_1 = require("socket.io");
const class_validator_1 = require("class-validator");
const entities_1 = require("../../database/entities");
let OrdersGateway = class OrdersGateway {
    constructor(jwtService, config, orders, restaurants) {
        this.jwtService = jwtService;
        this.config = config;
        this.orders = orders;
        this.restaurants = restaurants;
    }
    handleConnection(client) {
        const authorization = client.handshake.headers.authorization;
        const authToken = client.handshake.auth?.token;
        const token = typeof authToken === 'string'
            ? authToken
            : authorization?.startsWith('Bearer ')
                ? authorization.slice(7)
                : undefined;
        try {
            client.data.user = this.jwtService.verify(token ?? '', {
                secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
            });
        }
        catch {
            client.disconnect(true);
        }
    }
    async subscribeOrder(client, body) {
        const orderId = this.readId(body, 'orderId');
        const order = orderId
            ? await this.orders.findOne({ where: { id: orderId }, relations: { restaurant: true } })
            : null;
        if (!order || !this.canReadOrder(client.data.user, order)) {
            return { ok: false, error: 'FORBIDDEN' };
        }
        await client.join(this.orderRoom(order.id));
        return { ok: true, payload: this.payload(order) };
    }
    async subscribeMerchant(client, body) {
        const merchantId = this.readId(body, 'merchantId');
        const user = client.data.user;
        if (!merchantId ||
            !user ||
            (user.role !== entities_1.UserRole.ADMIN &&
                (user.role !== entities_1.UserRole.MERCHANT || user.sub !== merchantId))) {
            return { ok: false, error: 'FORBIDDEN' };
        }
        if (user.role !== entities_1.UserRole.ADMIN &&
            !(await this.restaurants.exists({ where: { ownerId: merchantId } }))) {
            return { ok: false, error: 'MERCHANT_HAS_NO_RESTAURANT' };
        }
        await client.join(this.merchantRoom(merchantId));
        return { ok: true, merchantId };
    }
    emitCreated(order) {
        this.server.to(this.merchantRoom(order.restaurant.ownerId)).emit('order.created', this.payload(order));
    }
    emitStatusUpdated(order) {
        const payload = this.payload(order);
        this.server.to(this.orderRoom(order.id)).emit('order.status.updated', payload);
        this.server.to(this.merchantRoom(order.restaurant.ownerId)).emit('order.status.updated', payload);
    }
    emitPaymentStatusUpdated(order, paymentStatus) {
        const payload = { ...this.payload(order), paymentStatus };
        this.server.to(this.orderRoom(order.id)).emit('payment.status.updated', payload);
        this.server
            .to(this.merchantRoom(order.restaurant.ownerId))
            .emit('payment.status.updated', payload);
    }
    payload(order) {
        return {
            orderId: order.id,
            orderCode: order.orderCode,
            status: order.status,
            paymentStatus: order.paymentStatus,
            updatedAt: order.updatedAt.toISOString(),
        };
    }
    canReadOrder(user, order) {
        return Boolean(user &&
            (user.role === entities_1.UserRole.ADMIN ||
                order.userId === user.sub ||
                order.restaurant.ownerId === user.sub));
    }
    readId(body, key) {
        if (typeof body === 'string')
            return (0, class_validator_1.isUUID)(body) ? body : undefined;
        if (body && typeof body === 'object' && key in body) {
            const value = body[key];
            return typeof value === 'string' && (0, class_validator_1.isUUID)(value) ? value : undefined;
        }
        return undefined;
    }
    orderRoom(orderId) {
        return `order:${orderId}`;
    }
    merchantRoom(merchantId) {
        return `merchant:${merchantId}`;
    }
};
exports.OrdersGateway = OrdersGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], OrdersGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('order.subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersGateway.prototype, "subscribeOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('merchant.subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersGateway.prototype, "subscribeMerchant", null);
exports.OrdersGateway = OrdersGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' }, namespace: 'orders' }),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.Order)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.Restaurant)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OrdersGateway);
//# sourceMappingURL=orders.gateway.js.map