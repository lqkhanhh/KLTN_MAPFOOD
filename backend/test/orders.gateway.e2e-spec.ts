import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { io, Socket as ClientSocket } from 'socket.io-client';
import request = require('supertest');
import { DataSource, EntityManager } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Restaurant,
  UserRole,
} from '../src/database/entities';
import {
  OrderEventPayload,
  OrdersGateway,
} from '../src/orders/gateway/orders.gateway';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';

describe('OrdersGateway network transport (e2e)', () => {
  const jwtSecret = 'socket-e2e-secret';
  const customerId = '11111111-1111-4111-8111-111111111111';
  const otherCustomerId = '22222222-2222-4222-8222-222222222222';
  const merchantId = '33333333-3333-4333-8333-333333333333';
  const restaurant = {
    id: '44444444-4444-4444-8444-444444444444',
    ownerId: merchantId,
    name: 'Socket Test Kitchen',
    address: 'HCMC',
  } as Restaurant;
  const order = {
    id: '55555555-5555-4555-8555-555555555555',
    orderCode: 'ORD-SOCKET-E2E',
    userId: customerId,
    restaurantId: restaurant.id,
    restaurant,
    type: OrderType.TAKE_AWAY,
    status: OrderStatus.PREPARING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    updatedAt: new Date('2026-08-30T03:00:00.000Z'),
  } as Order;

  let app: INestApplication;
  let gateway: OrdersGateway;
  let jwt: JwtService;
  let socketUrl: string;
  let clients: ClientSocket[];
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = jwtSecret;
    const orderRepository = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === order.id ? order : null,
      ),
      find: jest.fn().mockResolvedValue([order]),
      findOneBy: jest.fn().mockResolvedValue(order),
    };
    const manager = {
      findOne: jest.fn(async (entity: unknown) => (entity === Order ? order : restaurant)),
      findOneBy: jest.fn().mockResolvedValue(restaurant),
      save: jest.fn(async (_entity: unknown, value: Order) => {
        value.updatedAt = new Date();
        return value;
      }),
    };
    const dataSource = {
      transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
        callback(manager as unknown as EntityManager),
      ),
      getRepository: jest.fn(() => orderRepository),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [OrdersController],
      providers: [
        OrdersGateway,
        OrdersService,
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => jwtSecret },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(Restaurant),
          useValue: { exists: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    socketUrl = `http://127.0.0.1:${address.port}/orders`;
    gateway = moduleRef.get(OrdersGateway);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    if (previousJwtSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousJwtSecret;
  });

  beforeEach(() => {
    clients = [];
    order.status = OrderStatus.PREPARING;
    order.paymentStatus = OrderPaymentStatus.UNPAID;
    order.updatedAt = new Date('2026-08-30T03:00:00.000Z');
  });

  afterEach(() => {
    clients.forEach((client) => client.close());
  });

  it('disconnects a client without a valid JWT', async () => {
    const client = createClient('invalid-token');

    const reason = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket was not disconnected')), 2_000);
      client.on('disconnect', (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      client.connect();
    });

    expect(reason).toBe('io server disconnect');
  });

  it('allows the owner to join an order room and receive a status event', async () => {
    const client = await connectAs(customerId, UserRole.CUSTOMER);
    const acknowledgement = await emitWithAck(client, 'order.subscribe', {
      orderId: order.id,
    });
    expect(acknowledgement).toMatchObject({ ok: true });

    const eventPromise = waitForEvent(client, 'order.status.updated');
    gateway.emitStatusUpdated(order);

    await expect(eventPromise).resolves.toEqual({
      orderId: order.id,
      orderCode: order.orderCode,
      status: OrderStatus.PREPARING,
      paymentStatus: OrderPaymentStatus.UNPAID,
      updatedAt: order.updatedAt.toISOString(),
    });
  });

  it('rejects another customer from joining the order room', async () => {
    const client = await connectAs(otherCustomerId, UserRole.CUSTOMER);

    await expect(
      emitWithAck(client, 'order.subscribe', { orderId: order.id }),
    ).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('delivers new-order events to the authenticated merchant room', async () => {
    const client = await connectAs(merchantId, UserRole.MERCHANT);
    await expect(
      emitWithAck(client, 'merchant.subscribe', { merchantId }),
    ).resolves.toEqual({ ok: true, merchantId });

    const eventPromise = waitForEvent(client, 'order.created');
    gateway.emitCreated(order);

    await expect(eventPromise).resolves.toMatchObject({
      orderId: order.id,
      orderCode: order.orderCode,
    });
  });

  it('delivers payment updates through the real Socket.io transport', async () => {
    const client = await connectAs(customerId, UserRole.CUSTOMER);
    await emitWithAck(client, 'order.subscribe', { orderId: order.id });

    const eventPromise = waitForEvent(client, 'payment.status.updated');
    gateway.emitPaymentStatusUpdated(order, PaymentStatus.PAID);

    await expect(eventPromise).resolves.toMatchObject({
      orderId: order.id,
      status: order.status,
      paymentStatus: PaymentStatus.PAID,
    });
  });

  it('receives a status event after a real authenticated PATCH request', async () => {
    const customer = await connectAs(customerId, UserRole.CUSTOMER);
    await emitWithAck(customer, 'order.subscribe', { orderId: order.id });
    const merchantToken = signToken(merchantId, UserRole.MERCHANT);
    const eventPromise = waitForEvent(customer, 'order.status.updated');

    await request(app.getHttpServer())
      .patch(`/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ status: OrderStatus.READY })
      .expect(200);

    await expect(eventPromise).resolves.toMatchObject({
      orderId: order.id,
      status: OrderStatus.READY,
      paymentStatus: OrderPaymentStatus.UNPAID,
    });
  });

  function createClient(token: string) {
    const client = io(socketUrl, {
      auth: { token },
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    clients.push(client);
    return client;
  }

  async function connectAs(sub: string, role: UserRole) {
    const token = signToken(sub, role);
    const client = createClient(token);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 2_000);
      client.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.on('connect_error', reject);
      client.connect();
    });
    return client;
  }

  function signToken(sub: string, role: UserRole) {
    return jwt.sign(
      { sub, email: `${role}@example.com`, role },
      { secret: jwtSecret, expiresIn: '5m' },
    );
  }

  function emitWithAck(client: ClientSocket, event: string, payload: object) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      client.timeout(2_000).emit(
        event,
        payload,
        (error: Error | null, response: Record<string, unknown>) => {
          if (error) reject(error);
          else resolve(response);
        },
      );
    });
  }

  function waitForEvent(client: ClientSocket, event: string) {
    return new Promise<OrderEventPayload>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 2_000);
      client.once(event, (payload: OrderEventPayload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }
});
