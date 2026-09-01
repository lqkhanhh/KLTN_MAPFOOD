import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { isUUID } from 'class-validator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Order, PaymentStatus, Restaurant, UserRole } from '../../database/entities';

type AuthenticatedSocket = Socket & { data: { user?: AuthenticatedUser } };

export interface OrderEventPayload {
  orderId: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  updatedAt: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'orders' })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    const authorization = client.handshake.headers.authorization;
    const authToken: unknown = client.handshake.auth?.token;
    const token =
      typeof authToken === 'string'
        ? authToken
        : authorization?.startsWith('Bearer ')
          ? authorization.slice(7)
          : undefined;
    try {
      client.data.user = this.jwtService.verify<AuthenticatedUser>(token ?? '', {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('order.subscribe')
  async subscribeOrder(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: unknown,
  ) {
    const orderId = this.readId(body, 'orderId');
    const order = orderId
      ? await this.orders.findOne({ where: { id: orderId }, relations: { restaurant: true } })
      : null;
    if (!order || !this.canReadOrder(client.data.user, order)) {
      return { ok: false, error: 'FORBIDDEN' };
    }
    await client.join(this.orderRoom(order.id));
    return { ok: true, payload: this.payload(order) };
  }

  @SubscribeMessage('merchant.subscribe')
  async subscribeMerchant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: unknown,
  ) {
    const merchantId = this.readId(body, 'merchantId');
    const user = client.data.user;
    if (
      !merchantId ||
      !user ||
      (user.role !== UserRole.ADMIN &&
        (user.role !== UserRole.MERCHANT || user.sub !== merchantId))
    ) {
      return { ok: false, error: 'FORBIDDEN' };
    }
    if (
      user.role !== UserRole.ADMIN &&
      !(await this.restaurants.exists({ where: { ownerId: merchantId } }))
    ) {
      return { ok: false, error: 'MERCHANT_HAS_NO_RESTAURANT' };
    }
    await client.join(this.merchantRoom(merchantId));
    return { ok: true, merchantId };
  }

  emitCreated(order: Order) {
    this.server.to(this.merchantRoom(order.restaurant.ownerId)).emit('order.created', this.payload(order));
  }

  emitStatusUpdated(order: Order) {
    const payload = this.payload(order);
    this.server.to(this.orderRoom(order.id)).emit('order.status.updated', payload);
    this.server.to(this.merchantRoom(order.restaurant.ownerId)).emit('order.status.updated', payload);
  }

  emitPaymentStatusUpdated(order: Order, paymentStatus: PaymentStatus) {
    const payload = { ...this.payload(order), paymentStatus };
    this.server.to(this.orderRoom(order.id)).emit('payment.status.updated', payload);
    this.server
      .to(this.merchantRoom(order.restaurant.ownerId))
      .emit('payment.status.updated', payload);
  }

  private payload(order: Order): OrderEventPayload {
    return {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private canReadOrder(user: AuthenticatedUser | undefined, order: Order) {
    return Boolean(
      user &&
        (user.role === UserRole.ADMIN ||
          order.userId === user.sub ||
          order.restaurant.ownerId === user.sub),
    );
  }

  private readId(body: unknown, key: 'orderId' | 'merchantId') {
    if (typeof body === 'string') return isUUID(body) ? body : undefined;
    if (body && typeof body === 'object' && key in body) {
      const value = (body as Record<string, unknown>)[key];
      return typeof value === 'string' && isUUID(value) ? value : undefined;
    }
    return undefined;
  }

  private orderRoom(orderId: string) {
    return `order:${orderId}`;
  }

  private merchantRoom(merchantId: string) {
    return `merchant:${merchantId}`;
  }
}
