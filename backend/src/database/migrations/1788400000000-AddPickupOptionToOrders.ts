import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickupOptionToOrders1788400000000 implements MigrationInterface {
  name = 'AddPickupOptionToOrders1788400000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_schedule"`);
    await queryRunner.query(`CREATE TYPE "orders_pickup_type_enum" AS ENUM ('asap','scheduled')`);
    await queryRunner.query(`CREATE TYPE "orders_payment_method_enum" AS ENUM ('cash','vnpay')`);
    await queryRunner.query(`ALTER TYPE "payments_provider_enum" ADD VALUE IF NOT EXISTS 'VNPAY'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "pickupType" "orders_pickup_type_enum" NOT NULL DEFAULT 'asap'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "estimatedPickupMinutes" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "scheduledPickupTime" timestamptz`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "estimatedPickupAt" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "paymentMethod" "orders_payment_method_enum" NOT NULL DEFAULT 'cash'`);
    await queryRunner.query(`UPDATE "orders" SET "estimatedPickupMinutes" = 15, "estimatedPickupAt" = COALESCE("pickupTime", "createdAt" + interval '15 minutes')`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "type", DROP COLUMN "bookingTime", DROP COLUMN "guestCount", DROP COLUMN "pickupTime"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_pickup_option" CHECK (("pickupType" = 'asap' AND "estimatedPickupMinutes" > 0 AND "scheduledPickupTime" IS NULL) OR ("pickupType" = 'scheduled' AND "scheduledPickupTime" IS NOT NULL AND "estimatedPickupMinutes" IS NULL))`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { throw new Error('Irreversible checkout redesign migration'); }
}
