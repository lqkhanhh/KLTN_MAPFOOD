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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = exports.ORDER_STATUS_TRANSITIONS = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const entities_1 = require("../database/entities");
const orders_gateway_1 = require("./gateway/orders.gateway");
exports.ORDER_STATUS_TRANSITIONS = {
    [entities_1.OrderStatus.PENDING]: [entities_1.OrderStatus.CONFIRMED, entities_1.OrderStatus.CANCELLED],
    [entities_1.OrderStatus.CONFIRMED]: [entities_1.OrderStatus.PREPARING, entities_1.OrderStatus.CANCELLED],
    [entities_1.OrderStatus.PREPARING]: [entities_1.OrderStatus.READY],
    [entities_1.OrderStatus.READY]: [entities_1.OrderStatus.COMPLETED],
    [entities_1.OrderStatus.COMPLETED]: [],
    [entities_1.OrderStatus.CANCELLED]: [],
};
const MAX_MONEY_AMOUNT = 99_999_999_999_999;
let OrdersService = class OrdersService {
    constructor(dataSource, gateway) {
        this.dataSource = dataSource;
        this.gateway = gateway;
    }
    async create(dto, user) {
        const itemRequests = dto.items ?? [];
        const pickup = this.resolvePickupOption(dto);
        const orderId = await this.dataSource.transaction(async (manager) => {
            const restaurant = await manager.findOne(entities_1.Restaurant, {
                where: { id: dto.restaurantId },
                lock: { mode: 'pessimistic_read' },
            });
            if (!restaurant)
                throw new common_1.NotFoundException('Không tìm thấy quán');
            if (!restaurant.active)
                throw new common_1.ConflictException('Quán đang tạm ngừng nhận đơn');
            const customer = await manager.findOneBy(entities_1.User, { id: user.sub });
            if (!customer)
                throw new common_1.NotFoundException('Không tìm thấy tài khoản khách hàng');
            if (!customer.phone)
                throw new common_1.BadRequestException('Vui lòng cập nhật số điện thoại trước khi đặt đơn');
            const menuItems = itemRequests.length
                ? await manager.find(entities_1.MenuItem, {
                    where: {
                        id: (0, typeorm_1.In)(itemRequests.map((item) => item.menuItemId)),
                        restaurantId: dto.restaurantId,
                        available: true,
                    },
                })
                : [];
            if (menuItems.length !== itemRequests.length) {
                throw new common_1.BadRequestException('Có món không tồn tại, đã ngừng bán hoặc không thuộc quán đã chọn');
            }
            const menuById = new Map(menuItems.map((item) => [item.id, item]));
            const snapshots = itemRequests.map((request) => {
                const menuItem = menuById.get(request.menuItemId);
                const unitPrice = menuItem.price;
                if (!Number.isSafeInteger(unitPrice) ||
                    unitPrice < 0 ||
                    unitPrice > Math.floor(MAX_MONEY_AMOUNT / request.quantity)) {
                    throw new common_1.ConflictException('Giá trị món hoặc thành tiền vượt giới hạn hỗ trợ');
                }
                return manager.create(entities_1.OrderItem, {
                    menuItemId: menuItem.id,
                    itemName: menuItem.name,
                    unitPrice,
                    quantity: request.quantity,
                    lineTotal: unitPrice * request.quantity,
                    note: this.cleanOptionalText(request.note),
                });
            });
            const subtotal = snapshots.reduce((sum, item) => {
                if (sum > MAX_MONEY_AMOUNT - item.lineTotal) {
                    throw new common_1.ConflictException('Tổng giá trị đơn hàng vượt giới hạn hỗ trợ');
                }
                return sum + item.lineTotal;
            }, 0);
            const discountAmount = 0;
            const order = manager.create(entities_1.Order, {
                orderCode: this.createOrderCode(),
                userId: user.sub,
                restaurantId: restaurant.id,
                pickupType: dto.pickupOption.type,
                estimatedPickupMinutes: pickup.estimatedPickupMinutes,
                scheduledPickupTime: pickup.scheduledPickupTime,
                estimatedPickupAt: pickup.estimatedPickupAt,
                paymentMethod: dto.payment.method,
                status: entities_1.OrderStatus.PENDING,
                paymentStatus: entities_1.OrderPaymentStatus.UNPAID,
                subtotal,
                discountAmount,
                totalAmount: subtotal - discountAmount,
                customerName: customer.fullName,
                customerPhone: customer.phone,
                note: this.cleanOptionalText(dto.note),
                items: snapshots,
            });
            return (await manager.save(entities_1.Order, order)).id;
        });
        const created = await this.findEntity(orderId);
        if (created.paymentMethod === entities_1.OrderPaymentMethod.CASH)
            this.gateway.emitCreated(created);
        return this.toPublicOrder(created);
    }
    async findAllForUser(user, query) {
        const where = {};
        if (query.status)
            where.status = query.status;
        if (user.role === entities_1.UserRole.MERCHANT) {
            if (!query.restaurantId) {
                throw new common_1.BadRequestException('restaurantId là bắt buộc với tài khoản merchant');
            }
            await this.assertRestaurantOwner(query.restaurantId, user.sub);
            where.restaurantId = query.restaurantId;
        }
        else if (user.role === entities_1.UserRole.CUSTOMER) {
            where.userId = user.sub;
            if (query.restaurantId)
                where.restaurantId = query.restaurantId;
        }
        else if (query.restaurantId) {
            where.restaurantId = query.restaurantId;
        }
        const orders = await this.dataSource.getRepository(entities_1.Order).find({
            where,
            relations: { items: true, payments: true, review: true, restaurant: true },
            order: { createdAt: 'DESC' },
        });
        return orders.map((order) => this.toPublicOrder(order));
    }
    async findOneForUser(id, user) {
        const order = await this.findEntity(id);
        this.assertCanRead(order, user);
        return this.toPublicOrder(order);
    }
    async findEntityForUser(id, user) {
        const order = await this.findEntity(id);
        this.assertCanRead(order, user);
        return order;
    }
    async updateStatus(id, nextStatus, user) {
        const result = await this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(entities_1.Order, {
                where: { id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!order)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const restaurant = await manager.findOneBy(entities_1.Restaurant, { id: order.restaurantId });
            if (!restaurant)
                throw new common_1.NotFoundException('Không tìm thấy quán');
            if (user.role !== entities_1.UserRole.ADMIN && restaurant.ownerId !== user.sub) {
                throw new common_1.ForbiddenException('Bạn không quản lý quán của đơn hàng này');
            }
            if (order.status === nextStatus)
                return { orderId: order.id, changed: false };
            if (!exports.ORDER_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
                throw new common_1.ConflictException(`Không thể chuyển trạng thái từ ${order.status} sang ${nextStatus}`);
            }
            order.status = nextStatus;
            if (nextStatus === entities_1.OrderStatus.COMPLETED && order.paymentMethod === entities_1.OrderPaymentMethod.CASH) {
                order.paymentStatus = entities_1.OrderPaymentStatus.PAID;
            }
            order.statusUpdatedAt = new Date();
            order.statusUpdatedById = user.sub;
            await manager.save(entities_1.Order, order);
            return { orderId: order.id, changed: true };
        });
        const updated = await this.findEntity(result.orderId);
        if (result.changed)
            this.gateway.emitStatusUpdated(updated);
        return this.toPublicOrder(updated);
    }
    async findEntity(id) {
        const order = await this.dataSource.getRepository(entities_1.Order).findOne({
            where: { id },
            relations: { items: true, payments: true, review: true, restaurant: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        return order;
    }
    toPublicOrder(order) {
        return {
            id: order.id,
            orderCode: order.orderCode,
            userId: order.userId,
            restaurant: {
                id: order.restaurant.id,
                name: order.restaurant.name,
                address: order.restaurant.address,
            },
            pickupType: order.pickupType,
            estimatedPickupMinutes: order.estimatedPickupMinutes,
            scheduledPickupTime: order.scheduledPickupTime,
            estimatedPickupAt: order.estimatedPickupAt,
            paymentMethod: order.paymentMethod,
            status: order.status,
            paymentStatus: order.paymentStatus,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            totalAmount: order.totalAmount,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            note: order.note,
            items: (order.items ?? []).map((item) => ({
                id: item.id,
                menuItemId: item.menuItemId,
                itemName: item.itemName,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
                note: item.note,
            })),
            payments: (order.payments ?? []).map((payment) => ({
                id: payment.id,
                provider: payment.provider,
                transactionId: payment.transactionId,
                amount: payment.amount,
                status: payment.status,
                checkoutUrl: payment.checkoutUrl,
                qrCode: payment.qrCode,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
            })),
            review: order.review
                ? {
                    id: order.review.id,
                    rating: order.review.rating,
                    comment: order.review.comment,
                    createdAt: order.review.createdAt,
                }
                : null,
            statusUpdatedAt: order.statusUpdatedAt,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        };
    }
    assertCanRead(order, user) {
        if (user.role !== entities_1.UserRole.ADMIN &&
            order.userId !== user.sub &&
            order.restaurant.ownerId !== user.sub) {
            throw new common_1.ForbiddenException('Bạn không có quyền xem đơn hàng này');
        }
    }
    async assertRestaurantOwner(restaurantId, ownerId) {
        const restaurant = await this.dataSource.getRepository(entities_1.Restaurant).findOneBy({ id: restaurantId });
        if (!restaurant)
            throw new common_1.NotFoundException('Không tìm thấy quán');
        if (restaurant.ownerId !== ownerId)
            throw new common_1.ForbiddenException('Bạn không quản lý quán này');
    }
    resolvePickupOption(dto) {
        if (dto.pickupOption.type === entities_1.PickupType.ASAP) {
            const minutes = dto.pickupOption.estimatedPickupMinutes;
            if (!minutes || !Number.isInteger(minutes) || minutes < 1) {
                throw new common_1.BadRequestException('Thời gian chuẩn bị phải lớn hơn 0 phút');
            }
            return {
                estimatedPickupMinutes: minutes,
                scheduledPickupTime: undefined,
                estimatedPickupAt: new Date(Date.now() + minutes * 60_000),
            };
        }
        const scheduled = dto.pickupOption.scheduledTime
            ? new Date(dto.pickupOption.scheduledTime)
            : undefined;
        if (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Thời gian hẹn lấy món phải ở tương lai');
        }
        return {
            estimatedPickupMinutes: undefined,
            scheduledPickupTime: scheduled,
            estimatedPickupAt: scheduled,
        };
    }
    cleanOptionalText(value) {
        const cleaned = value?.trim();
        return cleaned || undefined;
    }
    createOrderCode() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        return `ORD-${date}-${(0, crypto_1.randomInt)(0, 36 ** 6).toString(36).padStart(6, '0').toUpperCase()}`;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        orders_gateway_1.OrdersGateway])
], OrdersService);
//# sourceMappingURL=orders.service.js.map