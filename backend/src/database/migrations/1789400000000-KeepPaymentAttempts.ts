import { MigrationInterface, QueryRunner } from 'typeorm';

export class KeepPaymentAttempts1789400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS "UQ_payments_order_id"');
    await q.query('DROP INDEX IF EXISTS "UQ_payments_order_id"');
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_payments_order_id" ON payments ("orderId")');
  }
  async down(q: QueryRunner): Promise<void> {
    // Fail safely if retries exist; never delete historical payment attempts on rollback.
    await q.query('CREATE UNIQUE INDEX "UQ_payments_order_id" ON payments ("orderId")');
    await q.query('DROP INDEX "IDX_payments_order_id"');
  }
}
