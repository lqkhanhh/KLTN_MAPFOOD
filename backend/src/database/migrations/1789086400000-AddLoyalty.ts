import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddLoyalty1789086400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD "pointsBalance" numeric(14,0) NOT NULL DEFAULT 0 CHECK ("pointsBalance" >= 0)`);
    await q.query(`CREATE TABLE vouchers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(40) NOT NULL UNIQUE, title varchar(160) NOT NULL,
      "discountType" varchar(10) NOT NULL CHECK ("discountType" IN ('percent','fixed')),
      "discountValue" integer NOT NULL CHECK ("discountValue" > 0 AND ("discountType" <> 'percent' OR "discountValue" <= 100)),
      "minOrderAmount" numeric(14,0) NOT NULL DEFAULT 0 CHECK ("minOrderAmount" >= 0),
      "pointsCost" integer CHECK ("pointsCost" > 0), active boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`ALTER TABLE orders ADD "appliedVoucherId" uuid REFERENCES vouchers(id) ON DELETE RESTRICT`);
    await q.query(`CREATE TABLE user_vouchers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "voucherId" uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
      "usedInOrderId" uuid UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
      "publicClaim" boolean NOT NULL DEFAULT false, "obtainedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "IDX_user_vouchers_user" ON user_vouchers ("userId")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_user_vouchers_public" ON user_vouchers ("userId", "voucherId") WHERE "publicClaim" = true`);
    await q.query(`CREATE TABLE points_transactions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount integer NOT NULL, type varchar(10) NOT NULL,
      "orderId" uuid REFERENCES orders(id) ON DELETE RESTRICT, "voucherId" uuid REFERENCES vouchers(id) ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CHECK ((type = 'earn' AND amount > 0 AND "orderId" IS NOT NULL) OR (type = 'redeem' AND amount < 0 AND "voucherId" IS NOT NULL))
    )`);
    await q.query(`CREATE INDEX "IDX_points_transactions_user" ON points_transactions ("userId", "createdAt")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_points_earn_order" ON points_transactions ("orderId") WHERE type = 'earn'`);
    // Bảng đổi cố định: một xu tương ứng 1.000đ giảm giá, không cấp xu giả cho tài khoản.
    await q.query(`INSERT INTO vouchers (code, title, "discountType", "discountValue", "minOrderAmount", "pointsCost") VALUES
      ('XU1000', 'Giảm 1.000đ', 'fixed', 1000, 10000, 1),
      ('XU5000', 'Giảm 5.000đ', 'fixed', 5000, 50000, 5),
      ('XU10000', 'Giảm 10.000đ', 'fixed', 10000, 100000, 10)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE points_transactions');
    await q.query('DROP TABLE user_vouchers');
    await q.query('ALTER TABLE orders DROP COLUMN "appliedVoucherId"');
    await q.query('DROP TABLE vouchers');
    await q.query('ALTER TABLE users DROP COLUMN "pointsBalance"');
  }
}
