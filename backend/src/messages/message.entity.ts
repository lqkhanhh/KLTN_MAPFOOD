import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { User } from '../database/entities/user.entity';

export enum MessageSenderRole { CUSTOMER = 'customer', MERCHANT = 'merchant' }
@Entity('messages')
@Index('IDX_messages_order_created', ['orderId', 'createdAt', 'id'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') orderId: string;
  @Column('uuid') senderId: string;
  @Column({ type: 'enum', enum: MessageSenderRole, enumName: 'message_sender_role' }) senderRole: MessageSenderRole;
  @Column({ type: 'varchar', length: 2000 }) content: string;
  @Column({ default: false }) isRead: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @ManyToOne(() => Order, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'orderId' }) order: Order;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'senderId' }) sender: User;
}
