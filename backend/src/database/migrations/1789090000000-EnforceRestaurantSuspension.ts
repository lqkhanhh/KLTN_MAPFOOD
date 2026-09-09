import { MigrationInterface, QueryRunner } from 'typeorm';
export class EnforceRestaurantSuspension1789090000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Sửa riêng trường hợp đã bị mở trái phép nhưng vẫn còn dấu đình chỉ; giữ nguyên lý do/ngày.
    await q.query(`UPDATE restaurants SET active = false, "updatedAt" = now()
      WHERE active = true AND ("suspendedAt" IS NOT NULL OR "suspendedReason" IS NOT NULL)`);
    await q.query(`ALTER TABLE restaurants ADD CONSTRAINT "CHK_restaurants_suspension_inactive"
      CHECK (NOT active OR ("suspendedAt" IS NULL AND "suspendedReason" IS NULL))`);
  }
  async down(q: QueryRunner): Promise<void> {
    // Không tự bật lại các quán đang bị đình chỉ khi rollback.
    await q.query('ALTER TABLE restaurants DROP CONSTRAINT "CHK_restaurants_suspension_inactive"');
  }
}
