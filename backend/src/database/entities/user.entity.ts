import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';
export enum UserRole { CUSTOMER = 'customer', MERCHANT = 'merchant', ADMIN = 'admin' }
@Entity('users') export class User { @PrimaryGeneratedColumn('uuid') id: string; @Column({ unique: true }) email: string; @Column() passwordHash: string; @Column() fullName: string; @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER }) role: UserRole; @Column({ nullable: true }) refreshTokenHash?: string; @OneToMany(() => Restaurant, r => r.owner) restaurants: Restaurant[]; @CreateDateColumn() createdAt: Date; @UpdateDateColumn() updatedAt: Date; }
