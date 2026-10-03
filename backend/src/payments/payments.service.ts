import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Order, OrderItem, OrderPaymentStatus, OrderPaymentMethod, OrderStatus, Payment, PaymentStatus, PaymentProvider, UserRole, Restaurant } from '../database/entities';
import { OrdersGateway } from '../orders/gateway/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_PROVIDER_ADAPTER, PaymentProviderAdapter, VerifiedPaymentWebhook } from './providers/payment-provider.interface';

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED],
  [PaymentStatus.FAILED]: [PaymentStatus.PAID],
  [PaymentStatus.CANCELLED]: [PaymentStatus.PAID],
  [PaymentStatus.EXPIRED]: [PaymentStatus.PAID],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
  [PaymentStatus.REFUNDED]: [],
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly gateway: OrdersGateway,
    @Inject(PAYMENT_PROVIDER_ADAPTER) private readonly provider: PaymentProviderAdapter,
    private readonly notifications: NotificationsService,
  ) {}

  async create(orderId: string, user: AuthenticatedUser, ipAddress?: string) {
    const accessible = await this.ordersService.findEntityForUser(orderId, user);
    if (user.role !== UserRole.ADMIN && accessible.userId !== user.sub) throw new ForbiddenException('Chỉ khách đặt đơn mới có thể tạo thanh toán');
    this.provider.validateConfiguration?.();
    const reservation = await this.dataSource.transaction(async manager => {
      const order = await manager.findOne(Order, { where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new BadRequestException('Không tìm thấy đơn hàng');
      if ([OrderStatus.CANCELLED, OrderStatus.COMPLETED].includes(order.status)) throw new ConflictException('Không thể thanh toán đơn đã hủy hoặc hoàn tất');
      if ([OrderPaymentStatus.PAID, OrderPaymentStatus.REFUNDED].includes(order.paymentStatus)) throw new ConflictException('Đơn hàng đã được thanh toán');
      if (order.paymentMethod !== OrderPaymentMethod.VNPAY) throw new ConflictException('Đơn tiền mặt không cần tạo giao dịch VNPAY');
      if (order.totalAmount <= 0) throw new ConflictException('Đơn hàng không có số tiền cần thanh toán');
      let payment = await manager.findOne(Payment, { where: { orderId }, order: { createdAt: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      if (payment?.status === PaymentStatus.PAID) throw new ConflictException('Đơn hàng đã được thanh toán');
      if (payment?.status === PaymentStatus.PENDING && (!payment.expiresAt || payment.expiresAt.getTime() > Date.now())) {
        if (!payment.qrCode && !payment.checkoutUrl) throw new ConflictException('Giao dịch đang được khởi tạo, vui lòng thử lại sau');
        if (!this.provider.canReuseCheckout || this.provider.canReuseCheckout(payment.checkoutUrl || '')) return { payment, create: false, order, items: [] as OrderItem[] };
      }
      const items = await manager.find(OrderItem, { where: { orderId } });
      payment = manager.create(Payment, {
        orderId, provider: this.provider.provider,
        transactionId: `${Date.now()}${randomInt(0, 1000).toString().padStart(3, '0')}`,
        amount: order.totalAmount, status: PaymentStatus.PENDING,
        providerPayload: { creationState: 'CREATING' }, expiresAt: new Date(Date.now() + 300000),
      });
      payment = await manager.save(Payment, payment);
      order.paymentStatus = OrderPaymentStatus.PENDING;
      await manager.save(Order, order);
      return { payment, create: true, order, items };
    });
    if (!reservation.create) return this.toResponse(reservation.payment);
    try {
      const result = await this.provider.createPayment({
        ipAddress, transactionId: reservation.payment.transactionId, orderCode: reservation.order.orderCode,
        amount: reservation.order.totalAmount, expiresAt: reservation.payment.expiresAt!,
        items: reservation.items.map(item => ({ name: item.itemName, quantity: item.quantity, price: item.unitPrice })),
      });
      const payment = await this.dataSource.transaction(async manager => {
        const current = await manager.findOneOrFail(Payment, { where: { id: reservation.payment.id }, lock: { mode: 'pessimistic_write' } });
        current.paymentLinkId = result.paymentLinkId;
        current.checkoutUrl = result.checkoutUrl;
        current.qrCode = result.qrCode;
        current.expiresAt = result.expiresAt ?? current.expiresAt;
        current.providerPayload = { ...current.providerPayload, ...result.safePayload };
        return manager.save(Payment, current);
      });
      return this.toResponse(payment);
    } catch (error) {
      await this.markCreationFailed(reservation.payment.id, reservation.payment.transactionId);
      if (error instanceof ConflictException) throw error;
      this.logger.error(`payment.create.failed paymentId=${reservation.payment.id}`);
      throw new BadGatewayException('Không thể tạo giao dịch thanh toán. Vui lòng thử lại sau.');
    }
  }

  async vnpayReturn(payload: unknown) {
    const verified = await this.provider.verifyWebhook(payload);
    const payment = await this.dataSource.getRepository(Payment).findOneBy({ provider: PaymentProvider.VNPAY, transactionId: verified.transactionId });
    if (!payment || payment.amount !== verified.amount || payment.providerPayload?.orderInfo !== verified.safePayload.orderCode) throw new BadRequestException('Kết quả thanh toán không khớp giao dịch');
    return { orderId: payment.orderId, status: payment.status, providerStatus: verified.status };
  }

  async vnpayIpn(payload: unknown) {
    let verified: VerifiedPaymentWebhook;
    try { verified = await this.provider.verifyWebhook(payload); }
    catch { return { RspCode: '97', Message: 'Invalid signature or payload' }; }
    try {
      const result = await this.applyVerified(verified);
      const messages: Record<string, string> = { '00': 'Confirm Success', '01': 'Order not found', '02': 'Order already confirmed', '04': 'Invalid amount' };
      return { RspCode: result.rspCode, Message: messages[result.rspCode] };
    } catch {
      this.logger.error('payment.ipn.processing_failed');
      return { RspCode: '99', Message: 'Processing failed' };
    }
  }

  async webhook(payload: unknown) {
    const verified = await this.provider.verifyWebhook(payload);
    const result = await this.applyVerified(verified);
    if (result.rspCode === '04') throw new BadRequestException('Số tiền webhook không khớp giao dịch');
    return { code: '00', desc: 'success', ignored: result.ignored };
  }

  private async applyVerified(verified: VerifiedPaymentWebhook) {
    const result = await this.dataSource.transaction(async manager => {
      const candidate = await manager.findOne(Payment, { where: { provider: this.provider.provider, transactionId: verified.transactionId } });
      if (!candidate) return { changed: false, ignored: true, rspCode: '01' };
      const order = await manager.findOne(Order, { where: { id: candidate.orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new BadRequestException('Không tìm thấy đơn hàng');
      const payment = await manager.findOne(Payment, { where: { id: candidate.id, provider: this.provider.provider, transactionId: verified.transactionId }, lock: { mode: 'pessimistic_write' } });
      if (!payment) return { changed: false, ignored: true, rspCode: '01' };
      if (payment.amount !== verified.amount) return { changed: false, ignored: true, rspCode: '04' };
      if (verified.paymentLinkId && payment.paymentLinkId && verified.paymentLinkId !== payment.paymentLinkId) throw new BadRequestException('Payment link không khớp');
      if (typeof verified.safePayload.orderCode === 'string' && verified.safePayload.orderCode !== (payment.providerPayload?.orderInfo ?? order.orderCode)) throw new BadRequestException('Mã đơn hàng không khớp');
      if (payment.status === verified.status) return { changed: false, ignored: false, rspCode: '02' };
      if (!TRANSITIONS[payment.status].includes(verified.status)) return { changed: false, ignored: true, rspCode: '02' };
      const settled = [OrderPaymentStatus.PAID, OrderPaymentStatus.REFUNDED].includes(order.paymentStatus);
      const latest = await manager.findOne(Payment, { where: { orderId: order.id }, order: { createdAt: 'DESC' } });
      const changed = !settled && (verified.status === PaymentStatus.PAID || latest?.id === payment.id);
      payment.status = verified.status;
      payment.paymentLinkId = verified.paymentLinkId ?? payment.paymentLinkId;
      payment.providerPayload = { ...payment.providerPayload, webhook: verified.safePayload,
        ...(settled && verified.status === PaymentStatus.PAID ? { reconciliationRequired: true } : {}) };
      if (verified.status === PaymentStatus.PAID) payment.paidAt ??= new Date();
      await manager.save(Payment, payment);
      if (changed) {
        order.paymentStatus = OrderPaymentStatus[verified.status];
        await manager.save(Order, order);
      }
      const restaurant = changed && verified.status === PaymentStatus.PAID && ![OrderStatus.CANCELLED, OrderStatus.COMPLETED].includes(order.status)
        ? await manager.findOneBy(Restaurant, { id: order.restaurantId }) : null;
      const notification = restaurant ? await this.notifications.create(restaurant.ownerId, 'Bạn có đơn hàng mới', `Đơn ${order.orderCode} đã thanh toán VNPAY, đang chờ xác nhận.`, { orderId: order.id, type: 'order_created' }, manager) : undefined;
      return { changed, ignored: false, rspCode: '00', orderId: order.id, notification };
    });
    if (result.changed && result.orderId) {
      try {
        this.notifications.publish(result.notification);
        const order = await this.ordersService.findEntity(result.orderId);
        this.gateway.emitPaymentStatusUpdated(order, verified.status);
        if (verified.status === PaymentStatus.PAID && ![OrderStatus.CANCELLED, OrderStatus.COMPLETED].includes(order.status)) this.gateway.emitCreated(order);
      } catch { this.logger.error(`payment.notification.failed orderId=${result.orderId}`); }
    }
    return result;
  }

  private async markCreationFailed(paymentId: string, transactionId: string) {
    await this.dataSource.transaction(async manager => {
      const candidate = await manager.findOne(Payment, { where: { id: paymentId, transactionId } });
      if (!candidate) return;
      const order = await manager.findOne(Order, { where: { id: candidate.orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) return;
      const payment = await manager.findOne(Payment, { where: { id: paymentId, transactionId }, lock: { mode: 'pessimistic_write' } });
      if (!payment || payment.status !== PaymentStatus.PENDING) return;
      payment.status = PaymentStatus.FAILED;
      payment.providerPayload = { creationState: 'FAILED' };
      await manager.save(Payment, payment);
      const latest = await manager.findOne(Payment, { where: { orderId: order.id }, order: { createdAt: 'DESC' } });
      if (latest?.id === payment.id && ![OrderPaymentStatus.PAID, OrderPaymentStatus.REFUNDED].includes(order.paymentStatus)) {
        order.paymentStatus = OrderPaymentStatus.FAILED;
        await manager.save(Order, order);
      }
    });
  }

  private toResponse(payment: Payment) {
    return { paymentId: payment.id, provider: payment.provider, transactionId: payment.transactionId,
      paymentLinkId: payment.paymentLinkId, checkoutUrl: payment.checkoutUrl, qrCode: payment.qrCode,
      amount: payment.amount, status: payment.status, expiresAt: payment.expiresAt };
  }
}
