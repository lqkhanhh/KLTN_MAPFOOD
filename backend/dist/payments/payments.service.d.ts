import { Repository } from 'typeorm';
import { Order, Payment } from '../database/entities';
import { OrdersService } from '../orders/orders.service';
export declare class PaymentsService {
    private payments;
    private orders;
    private orderService;
    constructor(payments: Repository<Payment>, orders: Repository<Order>, orderService: OrdersService);
    create(orderId: string): Promise<{
        paymentId: string;
        transactionCode: string;
        qrCode: string | undefined;
        expiresIn: number;
        amount: number;
    }>;
    webhook(orderCode: string, status: string): Promise<Order>;
    private qr;
}
