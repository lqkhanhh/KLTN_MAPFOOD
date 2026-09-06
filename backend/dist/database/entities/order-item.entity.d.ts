import { Order } from './order.entity';
import { MenuItem } from './menu-item.entity';
export declare class OrderItem {
    id: string;
    order: Order;
    orderId: string;
    menuItem?: MenuItem;
    menuItemId?: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    note?: string;
}
