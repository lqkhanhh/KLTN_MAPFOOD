import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { integerMoneyTransformer } from './numeric.transformer';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'numeric', precision: 14, scale: 0, transformer: integerMoneyTransformer })
  price: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: true })
  available: boolean;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.menuItems, { onDelete: 'CASCADE' })
  restaurant: Restaurant;

  @Column()
  restaurantId: string;
}
