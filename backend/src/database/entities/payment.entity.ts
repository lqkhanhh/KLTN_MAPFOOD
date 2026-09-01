import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { integerMoneyTransformer } from './numeric.transformer';

export enum PaymentProvider {
  /** Legacy values retained only to read historical records. New payments use VNPAY. */
  PAYOS = 'PAYOS',
  VIETQR = 'VIETQR',
  VNPAY = 'VNPAY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
@Index('UQ_payments_order_id', ['orderId'], { unique: true })
@Index('UQ_payments_provider_transaction', ['provider', 'transactionId'], { unique: true })
@Index('UQ_payments_provider_link', ['provider', 'paymentLinkId'], {
  unique: true,
  where: '"paymentLinkId" IS NOT NULL',
})
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  order: Order;

  @Column()
  orderId: string;

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  /** Numeric string used as payOS orderCode. */
  @Column({ length: 32 })
  transactionId: string;

  @Column({ nullable: true })
  paymentLinkId?: string;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  checkoutUrl?: string;

  @Column({ type: 'text', nullable: true })
  qrCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  providerPayload?: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
