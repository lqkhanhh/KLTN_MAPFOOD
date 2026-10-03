import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirebaseIdentity1789200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebaseUid" varchar(128)');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_firebase_uid" ON "users" ("firebaseUid")');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "firebaseUid"');
  }
}
