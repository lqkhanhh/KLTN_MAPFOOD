import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { MenuItem } from './menu-item.entity';
import { Review } from './review.entity';
import { Order } from './order.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: object;

  @Column({ default: '08:00-22:00' })
  openingHours: string;

  @Column({ default: true })
  active: boolean;

  /** Nguồn dữ liệu để Admin phân biệt quán merchant và dữ liệu bản đồ. */
  @Column({ length: 20, default: 'merchant' })
  source: string;

  /** Lý do hậu kiểm; chỉ có khi quán bị tạm ngưng. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  suspendedReason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  suspendedAt?: Date;

  @Column({ type: 'numeric', precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @ManyToOne(() => User, (user) => user.restaurants, { onDelete: 'CASCADE' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => MenuItem, (menuItem) => menuItem.restaurant, { cascade: true })
  menuItems: MenuItem[];

  @OneToMany(() => Order, (order) => order.restaurant)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.restaurant)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
