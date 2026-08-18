"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("./auth/auth.module");
const restaurants_module_1 = require("./restaurants/restaurants.module");
const search_module_1 = require("./search/search.module");
const orders_module_1 = require("./orders/orders.module");
const payments_module_1 = require("./payments/payments.module");
const reviews_module_1 = require("./reviews/reviews.module");
const entities_1 = require("./database/entities");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({ imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({ inject: [config_1.ConfigService], useFactory: (c) => ({ type: 'postgres', url: c.get('DATABASE_URL'), entities: entities_1.entities, synchronize: true, autoLoadEntities: true }) }),
            auth_module_1.AuthModule, restaurants_module_1.RestaurantsModule, search_module_1.SearchModule, orders_module_1.OrdersModule, payments_module_1.PaymentsModule, reviews_module_1.ReviewsModule,
        ] })
], AppModule);
//# sourceMappingURL=app.module.js.map