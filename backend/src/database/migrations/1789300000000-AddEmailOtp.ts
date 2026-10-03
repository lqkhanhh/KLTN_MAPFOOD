import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailOtp1789300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE auth_email_otps (
      email varchar(254) PRIMARY KEY,
      "challengeId" uuid NOT NULL,
      "codeHash" varchar(64) NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "sentAt" timestamptz NOT NULL DEFAULT now(),
      "windowStart" timestamptz NOT NULL DEFAULT now(),
      "sendCount" integer NOT NULL DEFAULT 1,
      attempts integer NOT NULL DEFAULT 0,
      consumed boolean NOT NULL DEFAULT false,
      delivered boolean NOT NULL DEFAULT false
    )`);
    await queryRunner.query(`CREATE TABLE auth_email_otp_budget (
      day date PRIMARY KEY,
      sends integer NOT NULL DEFAULT 0
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE auth_email_otps');
    await queryRunner.query('DROP TABLE auth_email_otp_budget');
  }
}
