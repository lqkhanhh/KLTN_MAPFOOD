import { Repository } from 'typeorm';
import { MenuItem, Order, OrderStatus } from '../database/entities';
import { CreateOrderDto } from './dto';
import { OrdersGateway } from './gateway/orders.gateway';
export declare class OrdersService {
    private orders;
    private menu;
    private gateway;
    constructor(orders: Repository<Order>, menu: Repository<MenuItem>, gateway: OrdersGateway);
    create(dto: CreateOrderDto, userId: string): Promise<Order>;
    findOne(id: string): Promise<Order>;
    status(id: string, status: OrderStatus): Promise<Order>;
}
