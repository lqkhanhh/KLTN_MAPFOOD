import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection } from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Order, PaymentStatus, Restaurant } from '../../database/entities';
type AuthenticatedSocket = Socket & {
    data: {
        user?: AuthenticatedUser;
    };
};
export interface OrderEventPayload {
    orderId: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
    updatedAt: string;
}
export declare class OrdersGateway implements OnGatewayConnection {
    private readonly jwtService;
    private readonly config;
    private readonly orders;
    private readonly restaurants;
    server: Server;
    constructor(jwtService: JwtService, config: ConfigService, orders: Repository<Order>, restaurants: Repository<Restaurant>);
    handleConnection(client: AuthenticatedSocket): void;
    subscribeOrder(client: AuthenticatedSocket, body: unknown): Promise<{
        ok: boolean;
        error: string;
        payload?: undefined;
    } | {
        ok: boolean;
        payload: OrderEventPayload;
        error?: undefined;
    }>;
    subscribeMerchant(client: AuthenticatedSocket, body: unknown): Promise<{
        ok: boolean;
        error: string;
        merchantId?: undefined;
    } | {
        ok: boolean;
        merchantId: string;
        error?: undefined;
    }>;
    emitCreated(order: Order): void;
    emitStatusUpdated(order: Order): void;
    emitPaymentStatusUpdated(order: Order, paymentStatus: PaymentStatus): void;
    private payload;
    private canReadOrder;
    private readId;
    private orderRoom;
    private merchantRoom;
}
export {};
