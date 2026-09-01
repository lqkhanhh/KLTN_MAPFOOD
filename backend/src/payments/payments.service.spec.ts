import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Restaurant,
  UserRole,
} from '../database/entities';
import { OrdersGateway } from '../orders/gateway/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderAdapter } from './providers';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const user: AuthenticatedUser = {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
  };
  const restaurant = {
    id: '22222222-2222-4222-8222-222222222222',
    ownerId: 'merchant-1',
  } as Restaurant;
  const order = {
    id: '33333333-3333-4333-8333-333333333333',
    orderCode: 'ORD-20260830-ABC123',
    userId: user.sub,
    restaurantId: restaurant.id,
    restaurant,
    type: OrderType.TAKE_AWAY,
    status: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    subtotal: 120_000,
    discountAmount: 0,
    totalAmount: 120_000,
    customerName: 'Nguyễn Văn A',
    customerPhone: '0900000000',
    items: [{ itemName: 'Bún bò', quantity: 2, unitPrice: 60_000 }],
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Order;

  let paymentState: Payment | null;
  let manager: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: DataSource;
  let ordersService: { findEntityForUser: jest.Mock; findEntity: jest.Mock };
  let gateway: { emitPaymentStatusUpdated: jest.Mock };
  let provider: PaymentProviderAdapter & {
    createPayment: jest.Mock;
    verifyWebhook: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    paymentState = null;
    order.paymentStatus = OrderPaymentStatus.UNPAID;
    manager = {
      findOne: jest.fn((entity) => Promise.resolve(entity === Order ? order : paymentState)),
      findOneOrFail: jest.fn(() => Promise.resolve(paymentState)),
      find: jest.fn((entity) =>
        Promise.resolve(entity === OrderItem ? order.items : []),
      ),
      create: jest.fn((_entity, value) => value),
      save: jest.fn((entity, value) => {
        if (entity === Payment) {
          paymentState = { ...value, id: value.id ?? '44444444-4444-4444-8444-444444444444' };
          return Promise.resolve(paymentState);
        }
        return Promise.resolve(value);
      }),
    };
    dataSource = {
      transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
        callback(manager as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    ordersService = {
      findEntityForUser: jest.fn().mockResolvedValue(order),
      findEntity: jest.fn().mockResolvedValue(order),
    };
    gateway = { emitPaymentStatusUpdated: jest.fn() };
    provider = {
      provider: PaymentProvider.PAYOS,
      createPayment: jest.fn().mockResolvedValue({
        paymentLinkId: 'link-1',
        checkoutUrl: 'https://pay.payos.vn/link-1',
        qrCode: 'qr-data',
        safePayload: { status: 'PENDING' },
      }),
      verifyWebhook: jest.fn(),
    };
    service = new PaymentsService(
      dataSource,
      ordersService as unknown as OrdersService,
      gateway as unknown as OrdersGateway,
      provider,
    );
  });

  it('creates a provider payment using the amount stored on the order', async () => {
    const response = await service.create(order.id, user);

    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 120_000, orderCode: order.orderCode }),
    );
    expect(response).toMatchObject({ amount: 120_000, checkoutUrl: 'https://pay.payos.vn/link-1' });
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PENDING);
  });

  it('returns an existing active payment without creating a duplicate', async () => {
    paymentState = payment({
      status: PaymentStatus.PENDING,
      qrCode: 'existing-qr',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await service.create(order.id, user);

    expect(response.qrCode).toBe('existing-qr');
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('does not return an incomplete payment while provider creation is in progress', async () => {
    paymentState = payment({
      status: PaymentStatus.PENDING,
      providerPayload: { creationState: 'CREATING' },
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.create(order.id, user)).rejects.toBeInstanceOf(ConflictException);
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('rejects payment creation when the order is already paid', async () => {
    order.paymentStatus = OrderPaymentStatus.PAID;
    await expect(service.create(order.id, user)).rejects.toBeInstanceOf(ConflictException);
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('rejects a webhook with an invalid signature before opening a transaction', async () => {
    provider.verifyWebhook.mockRejectedValue(new BadRequestException('invalid signature'));

    await expect(service.webhook({ signature: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('updates payment and order atomically for a valid webhook and emits after commit', async () => {
    paymentState = payment({ status: PaymentStatus.PENDING, order });
    provider.verifyWebhook.mockResolvedValue({
      transactionId: paymentState.transactionId,
      paymentLinkId: paymentState.paymentLinkId,
      amount: paymentState.amount,
      status: PaymentStatus.PAID,
      reference: 'BANK-REF',
      safePayload: { reference: 'BANK-REF' },
    });

    const response = await service.webhook({ signature: 'valid' });

    expect(response).toEqual({ code: '00', desc: 'success', ignored: false });
    expect(paymentState.status).toBe(PaymentStatus.PAID);
    expect(paymentState.paidAt).toBeInstanceOf(Date);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(manager.save).toHaveBeenCalledWith(Order, order);
    expect(gateway.emitPaymentStatusUpdated).toHaveBeenCalledWith(order, PaymentStatus.PAID);
    expect(manager.save.mock.invocationCallOrder.slice(-1)[0]).toBeLessThan(
      gateway.emitPaymentStatusUpdated.mock.invocationCallOrder[0],
    );
  });

  it('treats a repeated webhook as idempotent with no writes or event', async () => {
    order.paymentStatus = OrderPaymentStatus.PAID;
    paymentState = payment({ status: PaymentStatus.PAID, order, paidAt: new Date() });
    provider.verifyWebhook.mockResolvedValue({
      transactionId: paymentState.transactionId,
      amount: paymentState.amount,
      status: PaymentStatus.PAID,
      safePayload: {},
    });
    manager.save.mockClear();

    const response = await service.webhook({ signature: 'same-valid-event' });

    expect(response.ignored).toBe(false);
    expect(manager.save).not.toHaveBeenCalled();
    expect(gateway.emitPaymentStatusUpdated).not.toHaveBeenCalled();
  });

  it('ignores a stale failure webhook after a payment is already paid', async () => {
    order.paymentStatus = OrderPaymentStatus.PAID;
    paymentState = payment({ status: PaymentStatus.PAID, order, paidAt: new Date() });
    provider.verifyWebhook.mockResolvedValue({
      transactionId: paymentState.transactionId,
      amount: paymentState.amount,
      status: PaymentStatus.FAILED,
      safePayload: {},
    });
    manager.save.mockClear();

    const response = await service.webhook({ signature: 'stale-valid-event' });

    expect(response.ignored).toBe(true);
    expect(paymentState.status).toBe(PaymentStatus.PAID);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(manager.save).not.toHaveBeenCalled();
    expect(gateway.emitPaymentStatusUpdated).not.toHaveBeenCalled();
  });

  function payment(overrides: Partial<Payment> = {}): Payment {
    return {
      id: '44444444-4444-4444-8444-444444444444',
      orderId: order.id,
      order,
      provider: PaymentProvider.PAYOS,
      transactionId: '178802640000001',
      paymentLinkId: 'link-1',
      amount: order.totalAmount,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Payment;
  }
});
