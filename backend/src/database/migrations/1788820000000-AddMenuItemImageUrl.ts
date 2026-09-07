import { MigrationInterface, QueryRunner } from 'typeorm';

// restaurants.imageUrl đã được tạo ở migration discovery; không tạo trùng hoặc sửa migration cũ.
export class AddMenuItemImageUrl1788820000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "menu_items" ADD COLUMN "imageUrl" text NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "menu_items" DROP COLUMN "imageUrl"');
  }
}
