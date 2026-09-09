import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Order } from '../database/entities/order.entity';
import { integerMoneyTransformer } from '../database/entities/numeric.transformer';

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true, length: 40 }) code: string;
  @Column({ length: 160 }) title: string;
  @Column({ type: 'varchar', length: 10 }) discountType: 'percent' | 'fixed';
  @Column({ type: 'int' }) discountValue: number;
  @Column({ type: 'numeric', precision: 14, scale: 0, default: 0, transformer: integerMoneyTransformer }) minOrderAmount: number;
  @Column({ type: 'int', nullable: true }) pointsCost: number | null;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
@Entity('user_vouchers')
@Index('IDX_user_vouchers_user', ['userId'])
@Index('UQ_user_vouchers_public', ['userId', 'voucherId'], { unique: true, where: '"publicClaim" = true' })
export class UserVoucher {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column('uuid') voucherId: string;
  @Column({ type: 'uuid', nullable: true, unique: true }) usedInOrderId: string | null;
  @Column({ default: false }) publicClaim: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) obtainedAt: Date;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Voucher, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'voucherId' }) voucher: Voucher;
  @ManyToOne(() => Order, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'usedInOrderId' }) usedInOrder: Order;
}
@Entity('points_transactions')
@Index('IDX_points_transactions_user', ['userId', 'createdAt'])
@Index('UQ_points_earn_order', ['orderId'], { unique: true, where: 'type = \'earn\'' })
export class PointsTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column('int') amount: number;
  @Column({ type: 'varchar', length: 10 }) type: 'earn' | 'redeem';
  @Column({ type: 'uuid', nullable: true }) orderId: string | null;
  @Column({ type: 'uuid', nullable: true }) voucherId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Order, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'orderId' }) order: Order;
  @ManyToOne(() => Voucher, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'voucherId' }) voucher: Voucher;
}
