import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_unread', ['userId'], { where: '"isRead" = false' })
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ length: 160 }) title: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'jsonb', nullable: true }) data: Record<string, unknown> | null;
  @Column({ default: false }) isRead: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
