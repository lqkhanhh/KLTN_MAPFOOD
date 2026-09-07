import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1788800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "title" varchar(160) NOT NULL,
      "body" text NOT NULL,
      "data" jsonb,
      "isRead" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query('CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")');
    await queryRunner.query('CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("userId") WHERE "isRead" = false');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "notifications"');
  }
}
