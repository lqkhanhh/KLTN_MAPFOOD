import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderPaymentMethod,
  OrderStatus,
  Payment,
  PaymentStatus,
  UserRole,
} from '../database/entities';
import { OrdersGateway } from '../orders/gateway/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import {
  PAYMENT_PROVIDER_ADAPTER,
  PaymentProviderAdapter,
} from './providers/payment-provider.interface';

const PAYMENT_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],
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
    @Inject(PAYMENT_PROVIDER_ADAPTER)
    private readonly provider: PaymentProviderAdapter,
  ) {}

  async create(orderId: string, user: AuthenticatedUser) {
    const accessibleOrder = await this.ordersService.findEntityForUser(orderId, user);
    if (user.role !== UserRole.ADMIN && accessibleOrder.userId !== user.sub) {
      throw new ForbiddenException('Chỉ khách đặt đơn mới có thể tạo thanh toán');
    }

    const reservation = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new BadRequestException('Không tìm thấy đơn hàng');
      if ([OrderStatus.CANCELLED, OrderStatus.COMPLETED].includes(order.status)) {
        throw new ConflictException('Không thể thanh toán đơn đã hủy hoặc hoàn tất');
      }
      if (order.paymentStatus === OrderPaymentStatus.PAID) {
        throw new ConflictException('Đơn hàng đã được thanh toán');
      }
      if (order.paymentMethod !== OrderPaymentMethod.VNPAY) {
        throw new ConflictException('Đơn tiền mặt không cần tạo giao dịch VNPAY');
      }
      if (order.totalAmount <= 0) {
        throw new ConflictException('Đơn hàng không có số tiền cần thanh toán');
      }

      let payment = await manager.findOne(Payment, {
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (payment?.status === PaymentStatus.PAID) {
        throw new ConflictException('Đơn hàng đã được thanh toán');
      }
      if (
        payment?.status === PaymentStatus.PENDING &&
        (!payment.expiresAt || payment.expiresAt.getTime() > Date.now())
      ) {
        if (!payment.qrCode && !payment.checkoutUrl) {
          throw new ConflictException('Giao dịch đang được khởi tạo, vui lòng thử lại sau');
        }
        return { payment, shouldCreateAtProvider: false, order, items: [] as OrderItem[] };
      }

      const transactionId = this.createTransactionId();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const items = await manager.find(OrderItem, { where: { orderId } });
      if (payment) {
        Object.assign(payment, {
          provider: this.provider.provider,
          transactionId,
          paymentLinkId: undefined,
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
          checkoutUrl: undefined,
          qrCode: undefined,
          providerPayload: { creationState: 'CREATING' },
          expiresAt,
          paidAt: undefined,
        });
      } else {
        payment = manager.create(Payment, {
          orderId,
          provider: this.provider.provider,
          transactionId,
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
          providerPayload: { creationState: 'CREATING' },
          expiresAt,
        });
      }
      payment = await manager.save(Payment, payment);
      order.paymentStatus = OrderPaymentStatus.PENDING;
      await manager.save(Order, order);
      return { payment, shouldCreateAtProvider: true, order, items };
    });

    if (!reservation.shouldCreateAtProvider) return this.toResponse(reservation.payment);

    try {
      const result = await this.provider.createPayment({
        transactionId: reservation.payment.transactionId,
        orderCode: reservation.order.orderCode,
        amount: reservation.order.totalAmount,
        items: reservation.items.map((item) => ({
          name: item.itemName,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        expiresAt: reservation.payment.expiresAt!,
      });
      const payment = await this.dataSource.transaction(async (manager) => {
        const current = await manager.findOneOrFail(Payment, {
          where: { id: reservation.payment.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (current.transactionId !== reservation.payment.transactionId) {
          throw new ConflictException('Giao dịch đã được thay thế bởi một lần thử mới');
        }
        current.paymentLinkId = result.paymentLinkId;
        current.checkoutUrl = result.checkoutUrl;
        current.qrCode = result.qrCode;
        current.expiresAt = result.expiresAt ?? current.expiresAt;
        current.providerPayload = result.safePayload;
        return manager.save(Payment, current);
      });
      return this.toResponse(payment);
    } catch (error) {
      await this.markCreationFailed(reservation.payment.id, reservation.payment.transactionId);
      if (error instanceof ConflictException) throw error;
      const message = error instanceof Error ? error.message : 'Provider unavailable';
      this.logger.error(`payment.create.failed paymentId=${reservation.payment.id} provider=${this.provider.provider}`);
      throw new BadGatewayException(`Không thể tạo giao dịch: ${message}`);
    }
  }

  async webhook(payload: unknown) {
    const verified = await this.provider.verifyWebhook(payload);
    const result = await this.dataSource.transaction(async (manager) => {
      const candidate = await manager.findOne(Payment, {
        where: { provider: this.provider.provider, transactionId: verified.transactionId },
      });

      // payOS sends a correctly signed sample when confirming a webhook URL.
      if (!candidate) return { changed: false, ignored: true as const };
      const order = await manager.findOne(Order, {
        where: { id: candidate.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new BadRequestException('Không tìm thấy đơn hàng của giao dịch');
      const payment = await manager.findOne(Payment, {
        where: {
          id: candidate.id,
          provider: this.provider.provider,
          transactionId: verified.transactionId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      // A retry may have replaced the transaction while this webhook waited for the order lock.
      if (!payment) return { changed: false, ignored: true as const };
      if (payment.amount !== verified.amount) {
        throw new BadRequestException('Số tiền webhook không khớp giao dịch');
      }
      if (
        verified.paymentLinkId &&
        payment.paymentLinkId &&
        verified.paymentLinkId !== payment.paymentLinkId
      ) {
        throw new BadRequestException('Payment link trong webhook không khớp');
      }
      const webhookOrderCode = verified.safePayload.orderCode;
      if (
        typeof webhookOrderCode === 'string' &&
        webhookOrderCode !== order.orderCode
      ) {
        throw new BadRequestException('Mã đơn hàng trong webhook không khớp');
      }

      const isDuplicate =
        payment.status === verified.status &&
        order.paymentStatus === this.toOrderPaymentStatus(verified.status);
      if (isDuplicate) return { changed: false, ignored: false as const, orderId: order.id };
      if (!PAYMENT_STATUS_TRANSITIONS[payment.status].includes(verified.status)) {
        this.logger.warn(
          `payment.webhook.stale paymentId=${payment.id} current=${payment.status} received=${verified.status}`,
        );
        return { changed: false, ignored: true as const, orderId: order.id };
      }

      payment.status = verified.status;
      payment.paymentLinkId = verified.paymentLinkId ?? payment.paymentLinkId;
      payment.providerPayload = {
        ...(payment.providerPayload ?? {}),
        webhook: verified.safePayload,
      };
      if (verified.status === PaymentStatus.PAID) payment.paidAt = payment.paidAt ?? new Date();
      order.paymentStatus = this.toOrderPaymentStatus(verified.status);
      await manager.save(Payment, payment);
      await manager.save(Order, order);
      return { changed: true, ignored: false as const, orderId: order.id };
    });

    if ('orderId' in result && result.orderId && result.changed) {
      const order = await this.ordersService.findEntity(result.orderId);
      this.gateway.emitPaymentStatusUpdated(order, verified.status);
      this.logger.log(
        `payment.webhook.updated orderId=${order.id} status=${verified.status} provider=${this.provider.provider}`,
      );
    }
    return { code: '00', desc: 'success', ignored: result.ignored };
  }

  private async markCreationFailed(paymentId: string, transactionId: string) {
    await this.dataSource.transaction(async (manager) => {
      const candidate = await manager.findOne(Payment, {
        where: { id: paymentId, transactionId },
      });
      if (!candidate) return;
      const order = await manager.findOne(Order, {
        where: { id: candidate.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) return;
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId, transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || payment.status !== PaymentStatus.PENDING) return;
      payment.status = PaymentStatus.FAILED;
      payment.providerPayload = { creationState: 'FAILED' };
      order.paymentStatus = OrderPaymentStatus.FAILED;
      await manager.save(Payment, payment);
      await manager.save(Order, order);
    });
  }

  private toOrderPaymentStatus(status: PaymentStatus): OrderPaymentStatus {
    return OrderPaymentStatus[status];
  }

  private createTransactionId() {
    // Current millisecond timestamp + 3 digits remains below Number.MAX_SAFE_INTEGER.
    return `${Date.now()}${randomInt(0, 1000).toString().padStart(3, '0')}`;
  }

  private toResponse(payment: Payment) {
    return {
      paymentId: payment.id,
      provider: payment.provider,
      transactionId: payment.transactionId,
      paymentLinkId: payment.paymentLinkId,
      checkoutUrl: payment.checkoutUrl,
      qrCode: payment.qrCode,
      amount: payment.amount,
      status: payment.status,
      expiresAt: payment.expiresAt,
    };
  }
}
