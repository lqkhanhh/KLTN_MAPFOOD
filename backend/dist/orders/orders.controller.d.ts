import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
export declare class OrdersController {
    private service;
    constructor(service: OrdersService);
    create(dto: CreateOrderDto, user: any): Promise<import("../database/entities").Order>;
    one(id: string): Promise<import("../database/entities").Order>;
    status(id: string, dto: UpdateOrderStatusDto): Promise<import("../database/entities").Order>;
}
