import { Server } from 'socket.io';
export declare class OrdersGateway {
    server: Server;
    emitStatus(order: any): void;
}
