import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Restaurant } from '../database/entities/restaurant.entity';

@Entity('favorites')
@Unique('UQ_favorites_user_restaurant', ['userId', 'restaurantId'])
@Index('IDX_favorites_restaurant', ['restaurantId'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column('uuid') restaurantId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' }) restaurant: Restaurant;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
