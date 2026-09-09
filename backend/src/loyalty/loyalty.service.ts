import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { isUUID } from 'class-validator';
import { User, UserRole } from '../database/entities/user.entity';
import { Order, OrderPaymentStatus } from '../database/entities/order.entity';
import { PointsTransaction, UserVoucher, Voucher } from './loyalty.entity';

@Injectable()
export class LoyaltyService {
  constructor(private readonly dataSource: DataSource) {}
  private async account(manager: EntityManager, userId: string, lock = false, admin = false) {
    if (!isUUID(userId)) throw new UnauthorizedException();
    const user = await manager.findOne(User, { where: { id: userId }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!user) throw new UnauthorizedException();
    if (user.role !== (admin ? UserRole.ADMIN : UserRole.CUSTOMER)) throw new ForbiddenException();
    return user;
  }
  async points(userId: string) {
    const user = await this.account(this.dataSource.manager, userId);
    const transactions = await this.dataSource.getRepository(PointsTransaction).find({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return { pointsBalance: user.pointsBalance, transactions };
  }
  async available(userId: string) {
    await this.account(this.dataSource.manager, userId);
    return this.dataSource.getRepository(Voucher).find({ where: { active: true }, order: { createdAt: 'ASC', id: 'ASC' } });
  }
  async mine(userId: string) {
    await this.account(this.dataSource.manager, userId);
    return this.dataSource.getRepository(UserVoucher).find({ where: { userId }, relations: { voucher: true }, order: { obtainedAt: 'DESC', id: 'DESC' } });
  }
  async obtain(userId: string, voucherId: string, publicClaim: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.account(manager, userId, true);
      const voucher = await manager.findOne(Voucher, { where: { id: voucherId, active: true }, lock: { mode: 'pessimistic_read' } });
      if (!voucher) throw new NotFoundException('Voucher không tồn tại hoặc đã ngừng phát hành.');
      if (publicClaim !== (voucher.pointsCost === null)) throw new BadRequestException(publicClaim ? 'Voucher này cần đổi bằng xu.' : 'Voucher này nhận miễn phí, không cần đổi xu.');
      if (publicClaim) {
        const existing = await manager.findOneBy(UserVoucher, { userId, voucherId, publicClaim: true });
        if (existing) return { userVoucher: existing, pointsBalance: user.pointsBalance, alreadyClaimed: true };
      } else {
        const cost = voucher.pointsCost!;
        if (user.pointsBalance < cost) throw new BadRequestException('Không đủ xu để đổi voucher này.');
        await manager.decrement(User, { id: userId }, 'pointsBalance', cost);
        await manager.save(PointsTransaction, manager.create(PointsTransaction, { userId, voucherId, type: 'redeem', amount: -cost }));
        user.pointsBalance -= cost;
      }
      const userVoucher = await manager.save(UserVoucher, manager.create(UserVoucher, { userId, voucherId, publicClaim }));
      return { userVoucher, pointsBalance: user.pointsBalance };
    });
  }

  // Dùng trong transaction tạo đơn: khóa bản voucher đã nhận để không dùng đồng thời hai lần.
  async apply(manager: EntityManager, userId: string, userVoucherId: string | undefined, subtotal: number) {
    if (!userVoucherId) return { discountAmount: 0, voucherId: null, userVoucher: null };
    const owned = await manager.findOne(UserVoucher, { where: { id: userVoucherId, userId }, lock: { mode: 'pessimistic_write' } });
    if (!owned || owned.usedInOrderId) throw new ConflictException('Voucher không thuộc tài khoản hoặc đã được sử dụng.');
    const voucher = await manager.findOne(Voucher, { where: { id: owned.voucherId, active: true }, lock: { mode: 'pessimistic_read' } });
    if (!voucher) throw new ConflictException('Voucher đã ngừng hoạt động.');
    if (subtotal < voucher.minOrderAmount) throw new BadRequestException(`Đơn tối thiểu ${voucher.minOrderAmount.toLocaleString('vi-VN')}đ để dùng voucher này.`);
    // Tiền dùng số nguyên; nhân bằng BigInt để tránh mất chính xác với đơn giá trị lớn.
    const discount = voucher.discountType === 'percent'
      ? Number((BigInt(subtotal) * BigInt(voucher.discountValue) + 50n) / 100n) : voucher.discountValue;
    return { discountAmount: Math.min(subtotal, discount), voucherId: voucher.id, userVoucher: owned };
  }
  async earn(manager: EntityManager, order: Order) {
    if (order.paymentStatus !== OrderPaymentStatus.PAID) throw new ConflictException('Đơn chưa thanh toán, không thể hoàn thành và tích xu.');
    const amount = Math.floor(order.totalAmount / 100000);
    if (!amount || await manager.exists(PointsTransaction, { where: { orderId: order.id, type: 'earn' } })) return;
    const user = await manager.findOne(User, { where: { id: order.userId }, lock: { mode: 'pessimistic_write' } });
    if (!user) throw new NotFoundException('Không tìm thấy khách hàng');
    await manager.increment(User, { id: user.id }, 'pointsBalance', amount);
    await manager.save(PointsTransaction, manager.create(PointsTransaction, { userId: user.id, orderId: order.id, type: 'earn', amount }));
  }
  async adminList(userId: string) {
    await this.account(this.dataSource.manager, userId, false, true);
    return this.dataSource.getRepository(Voucher).find({ order: { createdAt: 'DESC' } });
  }
  async adminCreate(userId: string, data: { code: string; title: string; discountType: 'percent' | 'fixed'; discountValue: number; minOrderAmount: number }) {
    await this.account(this.dataSource.manager, userId, false, true);
    if (data.discountType === 'percent' && data.discountValue > 100) throw new BadRequestException('Mức giảm phần trăm không vượt quá 100%.');
    try { return await this.dataSource.getRepository(Voucher).save({ ...data, pointsCost: null, active: true }); }
    catch (error) { if ((error as { code?: string }).code === '23505') throw new ConflictException('Mã voucher đã tồn tại.'); throw error; }
  }
  async adminSetActive(userId: string, voucherId: string, active: boolean) {
    await this.account(this.dataSource.manager, userId, false, true);
    const result = await this.dataSource.getRepository(Voucher).update(voucherId, { active });
    if (!result.affected) throw new NotFoundException('Không tìm thấy voucher');
    return { id: voucherId, active };
  }
}
