import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from './menu-item.entity';
import { integerMoneyTransformer } from './numeric.transformer';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => MenuItem, { nullable: true, onDelete: 'SET NULL' })
  menuItem?: MenuItem;

  @Column({ type: 'uuid', nullable: true })
  menuItemId?: string;

  @Column({ length: 160 })
  itemName: string;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  unitPrice: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  lineTotal: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note?: string;
}
