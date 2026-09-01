import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { UserRole } from '../src/database/entities';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { ReviewsController } from '../src/reviews/reviews.controller';
import { ReviewsService } from '../src/reviews/reviews.service';

describe('Transaction API validation (e2e)', () => {
  let app: INestApplication;
  const ordersService = {
    create: jest.fn().mockResolvedValue({ id: 'order-id', status: 'PENDING' }),
    findAllForUser: jest.fn().mockResolvedValue([]),
    findOneForUser: jest.fn(),
    updateStatus: jest.fn(),
  };
  const paymentsService = { create: jest.fn(), webhook: jest.fn().mockResolvedValue({ code: '00' }) };
  const reviewsService = { create: jest.fn() };
  const authGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'customer@example.com',
        role: UserRole.CUSTOMER,
      };
      return true;
    },
  };

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [OrdersController, PaymentsController, ReviewsController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: ReviewsService, useValue: reviewsService },
      ],
    });
    const moduleRef = await builder
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app?.close());

  beforeEach(() => jest.clearAllMocks());

  it('accepts a valid TAKE_AWAY request through controller and validation', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        restaurantId: '22222222-2222-4222-8222-222222222222',
        type: 'TAKE_AWAY',
        customerName: 'Nguyễn Văn A',
        customerPhone: '0900000000',
        pickupTime: new Date(Date.now() + 60_000).toISOString(),
        items: [{ menuItemId: '33333333-3333-4333-8333-333333333333', quantity: 2 }],
      })
      .expect(201)
      .expect({ id: 'order-id', status: 'PENDING' });
    expect(ordersService.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a zero quantity before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        restaurantId: '22222222-2222-4222-8222-222222222222',
        type: 'TAKE_AWAY',
        customerName: 'Nguyễn Văn A',
        customerPhone: '0900000000',
        pickupTime: new Date(Date.now() + 60_000).toISOString(),
        items: [{ menuItemId: '33333333-3333-4333-8333-333333333333', quantity: 0 }],
      })
      .expect(400);
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('rejects client-controlled userId, totals and status fields', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        restaurantId: '22222222-2222-4222-8222-222222222222',
        type: 'BOOKING',
        customerName: 'Nguyễn Văn A',
        customerPhone: '0900000000',
        bookingTime: new Date(Date.now() + 60_000).toISOString(),
        guestCount: 2,
        userId: 'attacker',
        totalAmount: 1,
        status: 'COMPLETED',
      })
      .expect(400);
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('keeps the webhook public but requires its signature field', async () => {
    await request(app.getHttpServer()).post('/api/payments/webhook').send({}).expect(400);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({ signature: 'provider-signature', data: {} })
      .expect(200)
      .expect({ code: '00' });
    expect(paymentsService.webhook).toHaveBeenCalledTimes(1);
  });
});
