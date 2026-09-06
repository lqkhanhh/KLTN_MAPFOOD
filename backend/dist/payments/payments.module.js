"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("../auth/auth.module");
const orders_module_1 = require("../orders/orders.module");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const entities_1 = require("../database/entities");
const providers_1 = require("./providers");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, orders_module_1.OrdersModule],
        controllers: [payments_controller_1.PaymentsController],
        providers: [
            payments_service_1.PaymentsService,
            {
                provide: providers_1.PAYMENT_PROVIDER_ADAPTER,
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const provider = config.get('PAYMENT_PROVIDER', entities_1.PaymentProvider.VNPAY).toUpperCase();
                    if (provider === entities_1.PaymentProvider.VNPAY)
                        return new providers_1.VnpayProvider(config);
                    throw new Error('PAYMENT_PROVIDER must be VNPAY');
                },
            },
        ],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map