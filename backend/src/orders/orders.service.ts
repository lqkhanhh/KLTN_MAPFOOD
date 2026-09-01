import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource, FindOptionsWhere, In } from 'typeorm';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  MenuItem,
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
  OrderPaymentMethod,
  PickupType,
  Restaurant,
  User,
  UserRole,
} from '../database/entities';
import { CreateOrderDto, ListOrdersQueryDto } from './dto';
import { OrdersGateway } from './gateway/orders.gateway';

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const MAX_MONEY_AMOUNT = 99_999_999_999_999;

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    const itemRequests = dto.items ?? [];
    const pickup = this.resolvePickupOption(dto);

    const orderId = await this.dataSource.transaction(async (manager) => {
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: dto.restaurantId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
      if (!restaurant.active) throw new ConflictException('Quán đang tạm ngừng nhận đơn');
      const customer = await manager.findOneBy(User, { id: user.sub });
      if (!customer) throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
      if (!customer.phone) throw new BadRequestException('Vui lòng cập nhật số điện thoại trước khi đặt đơn');

      const menuItems = itemRequests.length
        ? await manager.find(MenuItem, {
            where: {
              id: In(itemRequests.map((item) => item.menuItemId)),
              restaurantId: dto.restaurantId,
              available: true,
            },
          })
        : [];
      if (menuItems.length !== itemRequests.length) {
        throw new BadRequestException(
          'Có món không tồn tại, đã ngừng bán hoặc không thuộc quán đã chọn',
        );
      }

      const menuById = new Map(menuItems.map((item) => [item.id, item]));
      const snapshots = itemRequests.map((request) => {
        const menuItem = menuById.get(request.menuItemId)!;
        const unitPrice = menuItem.price;
        if (
          !Number.isSafeInteger(unitPrice) ||
          unitPrice < 0 ||
          unitPrice > Math.floor(MAX_MONEY_AMOUNT / request.quantity)
        ) {
          throw new ConflictException('Giá trị món hoặc thành tiền vượt giới hạn hỗ trợ');
        }
        return manager.create(OrderItem, {
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          unitPrice,
          quantity: request.quantity,
          lineTotal: unitPrice * request.quantity,
          note: this.cleanOptionalText(request.note),
        });
      });
      const subtotal = snapshots.reduce((sum, item) => {
        if (sum > MAX_MONEY_AMOUNT - item.lineTotal) {
          throw new ConflictException('Tổng giá trị đơn hàng vượt giới hạn hỗ trợ');
        }
        return sum + item.lineTotal;
      }, 0);
      const discountAmount = 0;

      const order = manager.create(Order, {
        orderCode: this.createOrderCode(),
        userId: user.sub,
        restaurantId: restaurant.id,
        pickupType: dto.pickupOption.type,
        estimatedPickupMinutes: pickup.estimatedPickupMinutes,
        scheduledPickupTime: pickup.scheduledPickupTime,
        estimatedPickupAt: pickup.estimatedPickupAt,
        paymentMethod: dto.payment.method,
        status: OrderStatus.PENDING,
        paymentStatus: OrderPaymentStatus.UNPAID,
        subtotal,
        discountAmount,
        totalAmount: subtotal - discountAmount,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        note: this.cleanOptionalText(dto.note),
        items: snapshots,
      });
      return (await manager.save(Order, order)).id;
    });

    const created = await this.findEntity(orderId);
    this.gateway.emitCreated(created);
    return this.toPublicOrder(created);
  }

  async findAllForUser(user: AuthenticatedUser, query: ListOrdersQueryDto) {
    const where: FindOptionsWhere<Order> = {};
    if (query.status) where.status = query.status;

    if (user.role === UserRole.MERCHANT) {
      if (!query.restaurantId) {
        throw new BadRequestException('restaurantId là bắt buộc với tài khoản merchant');
      }
      await this.assertRestaurantOwner(query.restaurantId, user.sub);
      where.restaurantId = query.restaurantId;
    } else if (user.role === UserRole.CUSTOMER) {
      where.userId = user.sub;
      if (query.restaurantId) where.restaurantId = query.restaurantId;
    } else if (query.restaurantId) {
      where.restaurantId = query.restaurantId;
    }

    const orders = await this.dataSource.getRepository(Order).find({
      where,
      relations: { items: true, payments: true, review: true, restaurant: true },
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toPublicOrder(order));
  }

  async findOneForUser(id: string, user: AuthenticatedUser) {
    const order = await this.findEntity(id);
    this.assertCanRead(order, user);
    return this.toPublicOrder(order);
  }

  async findEntityForUser(id: string, user: AuthenticatedUser) {
    const order = await this.findEntity(id);
    this.assertCanRead(order, user);
    return order;
  }

  async updateStatus(id: string, nextStatus: OrderStatus, user: AuthenticatedUser) {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      const restaurant = await manager.findOneBy(Restaurant, { id: order.restaurantId });
      if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
      if (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.sub) {
        throw new ForbiddenException('Bạn không quản lý quán của đơn hàng này');
      }
      if (order.status === nextStatus) return { orderId: order.id, changed: false };
      if (!ORDER_STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
        throw new ConflictException(
          `Không thể chuyển trạng thái từ ${order.status} sang ${nextStatus}`,
        );
      }

      order.status = nextStatus;
      if (nextStatus === OrderStatus.COMPLETED && order.paymentMethod === OrderPaymentMethod.CASH) {
        order.paymentStatus = OrderPaymentStatus.PAID;
      }
      order.statusUpdatedAt = new Date();
      order.statusUpdatedById = user.sub;
      await manager.save(Order, order);
      return { orderId: order.id, changed: true };
    });

    const updated = await this.findEntity(result.orderId);
    if (result.changed) this.gateway.emitStatusUpdated(updated);
    return this.toPublicOrder(updated);
  }

  async findEntity(id: string) {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id },
      relations: { items: true, payments: true, review: true, restaurant: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  toPublicOrder(order: Order) {
    return {
      id: order.id,
      orderCode: order.orderCode,
      userId: order.userId,
      restaurant: {
        id: order.restaurant.id,
        name: order.restaurant.name,
        address: order.restaurant.address,
      },
      pickupType: order.pickupType,
      estimatedPickupMinutes: order.estimatedPickupMinutes,
      scheduledPickupTime: order.scheduledPickupTime,
      estimatedPickupAt: order.estimatedPickupAt,
      paymentMethod: order.paymentMethod,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      note: order.note,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        note: item.note,
      })),
      payments: (order.payments ?? []).map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        checkoutUrl: payment.checkoutUrl,
        qrCode: payment.qrCode,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
      review: order.review
        ? {
            id: order.review.id,
            rating: order.review.rating,
            comment: order.review.comment,
            createdAt: order.review.createdAt,
          }
        : null,
      statusUpdatedAt: order.statusUpdatedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private assertCanRead(order: Order, user: AuthenticatedUser) {
    if (
      user.role !== UserRole.ADMIN &&
      order.userId !== user.sub &&
      order.restaurant.ownerId !== user.sub
    ) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }
  }

  private async assertRestaurantOwner(restaurantId: string, ownerId: string) {
    const restaurant = await this.dataSource.getRepository(Restaurant).findOneBy({ id: restaurantId });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
    if (restaurant.ownerId !== ownerId) throw new ForbiddenException('Bạn không quản lý quán này');
  }

  private resolvePickupOption(dto: CreateOrderDto) {
    if (dto.pickupOption.type === PickupType.ASAP) {
      const minutes = dto.pickupOption.estimatedPickupMinutes;
      if (!minutes || !Number.isInteger(minutes) || minutes < 1) {
        throw new BadRequestException('Thời gian chuẩn bị phải lớn hơn 0 phút');
      }
      return {
        estimatedPickupMinutes: minutes,
        scheduledPickupTime: undefined,
        estimatedPickupAt: new Date(Date.now() + minutes * 60_000),
      };
    }

    const scheduled = dto.pickupOption.scheduledTime
      ? new Date(dto.pickupOption.scheduledTime)
      : undefined;
    if (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian hẹn lấy món phải ở tương lai');
    }
    return {
      estimatedPickupMinutes: undefined,
      scheduledPickupTime: scheduled,
      estimatedPickupAt: scheduled,
    };
  }

  private cleanOptionalText(value?: string) {
    const cleaned = value?.trim();
    return cleaned || undefined;
  }

  private createOrderCode() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ORD-${date}-${randomInt(0, 36 ** 6).toString(36).padStart(6, '0').toUpperCase()}`;
  }
}
