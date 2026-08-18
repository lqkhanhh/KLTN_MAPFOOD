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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const orders_gateway_1 = require("./gateway/orders.gateway");
let OrdersService = class OrdersService {
    constructor(orders, menu, gateway) {
        this.orders = orders;
        this.menu = menu;
        this.gateway = gateway;
    }
    async create(dto, userId) { const ids = dto.items.map(i => i.menuItemId); const menu = await this.menu.find({ where: { id: (0, typeorm_2.In)(ids), restaurantId: dto.restaurantId } }); if (menu.length !== ids.length)
        throw new common_1.NotFoundException('Món ăn không hợp lệ'); const map = new Map(menu.map(x => [x.id, x])); const items = dto.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, unitPrice: map.get(i.menuItemId).price })); const total = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0); const order = await this.orders.save(this.orders.create({ code: `RB${Date.now()}`, type: dto.type, pickupAt: new Date(dto.pickupAt), customerId: userId, restaurantId: dto.restaurantId, totalAmount: total, items: items })); return order; }
    async findOne(id) { const result = await this.orders.findOne({ where: { id }, relations: ['items', 'restaurant'] }); if (!result)
        throw new common_1.NotFoundException('Không tìm thấy đơn'); return result; }
    async status(id, status) { const order = await this.findOne(id); order.status = status; const saved = await this.orders.save(order); this.gateway.emitStatus(saved); return saved; }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.MenuItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeorm_2.Repository, orders_gateway_1.OrdersGateway])
], OrdersService);
//# sourceMappingURL=orders.service.js.map