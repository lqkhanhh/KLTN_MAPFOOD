import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchantApplications1788900000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`CREATE TABLE "merchant_applications" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      "status" varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
      "shop" jsonb NOT NULL, "bankEncrypted" bytea, "agreements" jsonb, "termsVersion" varchar, "acceptedAt" timestamptz,
      "submittedAt" timestamptz, "reviewedById" uuid, "reviewedAt" timestamptz, "rejectionReason" varchar(500), "restaurantId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE INDEX "idx_merchant_applications_status" ON "merchant_applications" (status, "createdAt")`);
    await runner.query(`CREATE TABLE "merchant_application_documents" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "applicationId" uuid NOT NULL REFERENCES merchant_applications(id) ON DELETE CASCADE,
      "kind" varchar(40) NOT NULL CHECK (kind IN ('identity_front','identity_back','business_license','food_safety')),
      "mimeType" varchar(50) NOT NULL, "size" integer NOT NULL, "encryptedContent" bytea NOT NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("applicationId", kind)
    )`);
  }
  async down(runner: QueryRunner) {
    await runner.query('DROP TABLE "merchant_application_documents"');
    await runner.query('DROP TABLE "merchant_applications"');
  }
}
