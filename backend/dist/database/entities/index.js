"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.entities = void 0;
__exportStar(require("./user.entity"), exports);
__exportStar(require("./restaurant.entity"), exports);
__exportStar(require("./menu-item.entity"), exports);
__exportStar(require("./order.entity"), exports);
__exportStar(require("./order-item.entity"), exports);
__exportStar(require("./payment.entity"), exports);
__exportStar(require("./review.entity"), exports);
__exportStar(require("./route-search-log.entity"), exports);
const user_entity_1 = require("./user.entity");
const restaurant_entity_1 = require("./restaurant.entity");
const menu_item_entity_1 = require("./menu-item.entity");
const order_entity_1 = require("./order.entity");
const order_item_entity_1 = require("./order-item.entity");
const payment_entity_1 = require("./payment.entity");
const review_entity_1 = require("./review.entity");
const route_search_log_entity_1 = require("./route-search-log.entity");
exports.entities = [user_entity_1.User, restaurant_entity_1.Restaurant, menu_item_entity_1.MenuItem, order_entity_1.Order, order_item_entity_1.OrderItem, payment_entity_1.Payment, review_entity_1.Review, route_search_log_entity_1.RouteSearchLog];
//# sourceMappingURL=index.js.map