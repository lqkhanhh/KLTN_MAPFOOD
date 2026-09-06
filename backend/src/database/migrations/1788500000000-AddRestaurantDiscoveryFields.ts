import { MigrationInterface, QueryRunner } from 'typeorm';

/** Thông tin cần thiết để duyệt/lọc quán ở giao diện khách hàng. */
export class AddRestaurantDiscoveryFields1788500000000 implements MigrationInterface {
  name = 'AddRestaurantDiscoveryFields1788500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "category" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "imageUrl" text`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_restaurants_active_category" ON "restaurants" ("active", "category")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_active_category"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "category"`);
  }
}
