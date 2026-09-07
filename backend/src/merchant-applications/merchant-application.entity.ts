import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, Unique } from 'typeorm';
import { User } from '../database/entities/user.entity';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export interface ShopDetails { name: string; address: string; latitude: number; longitude: number; category: string; openingHours: string }
export interface Agreements { accuracy: boolean; terms: boolean; documentReview: boolean }
export const DOCUMENT_KINDS = ['identity_front', 'identity_back', 'business_license', 'food_safety'] as const;
export type DocumentKind = typeof DOCUMENT_KINDS[number];

@Entity('merchant_applications')
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' }) status: ApplicationStatus;
  @Column({ type: 'jsonb' }) shop: ShopDetails;
  @Column({ type: 'bytea', nullable: true, select: false }) bankEncrypted: Buffer | null;
  @Column({ type: 'jsonb', nullable: true }) agreements: Agreements | null;
  @Column({ type: 'varchar', nullable: true }) termsVersion: string | null;
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) reviewedById: string | null;
  @Column({ type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) rejectionReason: string | null;
  @Column({ type: 'uuid', nullable: true }) restaurantId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('merchant_application_documents') @Unique(['applicationId', 'kind'])
export class MerchantApplicationDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) applicationId: string;
  @ManyToOne(() => MerchantApplication, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'applicationId' }) application: MerchantApplication;
  @Column({ type: 'varchar', length: 40 }) kind: DocumentKind;
  @Column({ type: 'varchar', length: 50 }) mimeType: string;
  @Column({ type: 'int' }) size: number;
  @Column({ type: 'bytea', select: false }) encryptedContent: Buffer;
  @UpdateDateColumn() updatedAt: Date;
}
