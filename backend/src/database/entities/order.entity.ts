import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Restaurant } from './restaurant.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';
import { Review } from './review.entity';
import { integerMoneyTransformer } from './numeric.transformer';

export enum PickupType { ASAP = 'asap', SCHEDULED = 'scheduled' }
export enum OrderPaymentMethod { CASH = 'cash', VNPAY = 'vnpay' }

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderPaymentStatus {
  UNPAID = 'UNPAID',
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

@Entity('orders')
@Index('IDX_orders_user_created_at', ['userId', 'createdAt'])
@Index('IDX_orders_restaurant_status_created_at', ['restaurantId', 'status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 32 })
  orderCode: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'RESTRICT' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.orders, { onDelete: 'RESTRICT' })
  restaurant: Restaurant;

  @Column()
  restaurantId: string;

  @Column({ type: 'enum', enum: PickupType })
  pickupType: PickupType;

  @Column({ type: 'integer', nullable: true })
  estimatedPickupMinutes?: number;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledPickupTime?: Date;

  @Column({ type: 'timestamptz' })
  estimatedPickupAt: Date;

  @Column({ type: 'enum', enum: OrderPaymentMethod, default: OrderPaymentMethod.CASH })
  paymentMethod: OrderPaymentMethod;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.UNPAID,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 0,
    default: 0,
    transformer: integerMoneyTransformer,
  })
  discountAmount: number;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  totalAmount: number;

  @Column({ length: 120 })
  customerName: string;

  @Column({ length: 20 })
  customerPhone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note?: string;


  @Column({ type: 'uuid', nullable: true })
  statusUpdatedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'statusUpdatedById' })
  statusUpdatedBy?: User;

  @Column({ type: 'timestamptz', nullable: true })
  statusUpdatedAt?: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @OneToOne(() => Review, (review) => review.order)
  review?: Review;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
