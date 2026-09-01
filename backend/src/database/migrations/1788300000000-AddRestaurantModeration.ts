import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantModeration1788300000000 implements MigrationInterface {
  name = 'AddRestaurantModeration1788300000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'merchant'`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "suspendedReason" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "suspendedAt" timestamptz`);
    await queryRunner.query(`CREATE INDEX "IDX_restaurants_active_source" ON "restaurants" ("active", "source")`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_restaurants_active_source"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "suspendedAt"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "suspendedReason"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "source"`);
  }
}
