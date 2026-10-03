import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
  PickupType,
  OrderPaymentMethod,
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
    pickupType: PickupType.ASAP,
    estimatedPickupAt: new Date(),
    paymentMethod: OrderPaymentMethod.VNPAY,
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
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: DataSource;
  let ordersService: { findEntityForUser: jest.Mock; findEntity: jest.Mock };
  let gateway: { emitPaymentStatusUpdated: jest.Mock; emitCreated: jest.Mock };
  let provider: PaymentProviderAdapter & {
    createPayment: jest.Mock;
    verifyWebhook: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    paymentState = null;
    order.paymentStatus = OrderPaymentStatus.UNPAID;
    manager = {
      findOneBy: jest.fn().mockResolvedValue(restaurant),
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
    gateway = { emitPaymentStatusUpdated: jest.fn(), emitCreated: jest.fn() };
    provider = {
      provider: PaymentProvider.VNPAY,
      createPayment: jest.fn().mockResolvedValue({
        paymentLinkId: 'link-1',
        checkoutUrl: 'https://example.invalid/checkout',
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
      { create: jest.fn(), publish: jest.fn() } as never,
    );
  });

  it('creates a provider payment using the amount stored on the order', async () => {
    const response = await service.create(order.id, user);

    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 120_000, orderCode: order.orderCode }),
    );
    expect(response).toMatchObject({ amount: 120_000, checkoutUrl: 'https://example.invalid/checkout' });
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

  it('returns IPN protocol codes without mutating rejected payments', async () => {
    provider.verifyWebhook.mockRejectedValueOnce(new BadRequestException());
    expect((await service.vnpayIpn({})).RspCode).toBe('97');
    provider.verifyWebhook.mockResolvedValue({ transactionId: 'missing', amount: 1, status: PaymentStatus.PAID, safePayload: {} });
    expect((await service.vnpayIpn({})).RspCode).toBe('01');
    paymentState = payment();
    expect((await service.vnpayIpn({})).RspCode).toBe('04');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('acknowledges a successful IPN once and repeated IPNs with 02', async () => {
    paymentState = payment();
    provider.verifyWebhook.mockResolvedValue({ transactionId: paymentState.transactionId, amount: paymentState.amount, status: PaymentStatus.PAID, safePayload: {} });
    expect((await service.vnpayIpn({})).RspCode).toBe('00');
    manager.save.mockClear();
    expect((await service.vnpayIpn({})).RspCode).toBe('02');
    expect(manager.save).not.toHaveBeenCalled();
    expect(gateway.emitCreated).toHaveBeenCalledTimes(1);
  });

  it('verifies browser return without marking the order paid', async () => {
    paymentState = payment({ providerPayload: { orderInfo: 'order' } });
    Object.assign(dataSource, { getRepository: () => ({ findOneBy: async () => paymentState }) });
    provider.verifyWebhook.mockResolvedValue({ transactionId: paymentState.transactionId, amount: paymentState.amount, status: PaymentStatus.PAID, safePayload: { orderCode: 'order' } });
    expect(await service.vnpayReturn({})).toEqual({ orderId: order.id, status: PaymentStatus.PENDING, providerStatus: PaymentStatus.PAID });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('creates a new attempt without overwriting a failed transaction', async () => {
    const previous = payment({ status: PaymentStatus.FAILED });
    paymentState = previous;
    await service.create(order.id, user);
    expect(manager.create).toHaveBeenCalledWith(Payment, expect.not.objectContaining({ id: previous.id }));
    expect(previous.status).toBe(PaymentStatus.FAILED);
    expect(previous.transactionId).toBe('178802640000001');
  });

  it('does not let an older failed attempt downgrade the latest attempt', async () => {
    const previous = payment();
    const latest = payment({ id: 'latest' });
    manager.findOne.mockImplementation((entity, options) => Promise.resolve(entity === Order ? order : options.order ? latest : previous));
    order.paymentStatus = OrderPaymentStatus.PENDING;
    provider.verifyWebhook.mockResolvedValue({ transactionId: previous.transactionId, amount: previous.amount, status: PaymentStatus.FAILED, safePayload: {} });
    expect((await service.vnpayIpn({})).RspCode).toBe('00');
    expect(previous.status).toBe(PaymentStatus.FAILED);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PENDING);
    expect(gateway.emitPaymentStatusUpdated).not.toHaveBeenCalled();
  });

  function payment(overrides: Partial<Payment> = {}): Payment {
    return {
      id: '44444444-4444-4444-8444-444444444444',
      orderId: order.id,
      order,
      provider: PaymentProvider.VNPAY,
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
