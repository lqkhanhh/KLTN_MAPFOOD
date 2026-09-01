import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788026400000 implements MigrationInterface {
  name = 'InitialSchema1788026400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await queryRunner.query("CREATE TYPE \"users_role_enum\" AS ENUM ('customer', 'merchant', 'admin')");
    await queryRunner.query("CREATE TYPE \"orders_type_enum\" AS ENUM ('BOOKING', 'TAKE_AWAY')");
    await queryRunner.query(
      "CREATE TYPE \"orders_status_enum\" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')",
    );
    await queryRunner.query(
      "CREATE TYPE \"orders_payment_status_enum\" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')",
    );
    await queryRunner.query("CREATE TYPE \"payments_provider_enum\" AS ENUM ('PAYOS', 'VIETQR')");
    await queryRunner.query(
      "CREATE TYPE \"payments_status_enum\" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED')",
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "passwordHash" varchar NOT NULL,
        "fullName" varchar(120) NOT NULL,
        "phone" varchar(20),
        "role" "users_role_enum" NOT NULL DEFAULT 'customer',
        "refreshTokenHash" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "restaurants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "address" varchar NOT NULL,
        "location" geography(Point,4326) NOT NULL,
        "openingHours" varchar NOT NULL DEFAULT '08:00-22:00',
        "active" boolean NOT NULL DEFAULT true,
        "rating" numeric(2,1) NOT NULL DEFAULT 0,
        "reviewCount" integer NOT NULL DEFAULT 0,
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurants_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_restaurants_location" ON "restaurants" USING GIST ("location")',
    );
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(160) NOT NULL,
        "price" numeric(14,0) NOT NULL,
        "description" varchar,
        "available" boolean NOT NULL DEFAULT true,
        "restaurantId" uuid NOT NULL,
        CONSTRAINT "PK_menu_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_menu_items_price" CHECK ("price" >= 0),
        CONSTRAINT "FK_menu_items_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderCode" varchar(32) NOT NULL,
        "userId" uuid NOT NULL,
        "restaurantId" uuid NOT NULL,
        "type" "orders_type_enum" NOT NULL,
        "status" "orders_status_enum" NOT NULL DEFAULT 'PENDING',
        "paymentStatus" "orders_payment_status_enum" NOT NULL DEFAULT 'UNPAID',
        "subtotal" numeric(14,0) NOT NULL,
        "discountAmount" numeric(14,0) NOT NULL DEFAULT 0,
        "totalAmount" numeric(14,0) NOT NULL,
        "customerName" varchar(120) NOT NULL,
        "customerPhone" varchar(20) NOT NULL,
        "note" varchar(500),
        "bookingTime" timestamptz,
        "guestCount" smallint,
        "pickupTime" timestamptz,
        "statusUpdatedById" uuid,
        "statusUpdatedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_code" UNIQUE ("orderCode"),
        CONSTRAINT "CHK_orders_amounts" CHECK ("subtotal" >= 0 AND "discountAmount" >= 0 AND "totalAmount" = "subtotal" - "discountAmount"),
        CONSTRAINT "CHK_orders_schedule" CHECK (("type" = 'BOOKING' AND "bookingTime" IS NOT NULL AND "guestCount" > 0 AND "pickupTime" IS NULL) OR ("type" = 'TAKE_AWAY' AND "pickupTime" IS NOT NULL AND "bookingTime" IS NULL AND "guestCount" IS NULL)),
        CONSTRAINT "FK_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_status_updated_by" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_orders_user_created_at" ON "orders" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_orders_restaurant_status_created_at" ON "orders" ("restaurantId", "status", "createdAt")',
    );
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "menuItemId" uuid,
        "itemName" varchar(160) NOT NULL,
        "unitPrice" numeric(14,0) NOT NULL,
        "quantity" integer NOT NULL,
        "lineTotal" numeric(14,0) NOT NULL,
        "note" varchar(200),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_items_values" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "lineTotal" = "unitPrice" * "quantity"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_menu_item" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "provider" "payments_provider_enum" NOT NULL,
        "transactionId" varchar(32) NOT NULL,
        "paymentLinkId" varchar,
        "amount" numeric(14,0) NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "checkoutUrl" text,
        "qrCode" text,
        "providerPayload" jsonb,
        "expiresAt" timestamptz,
        "paidAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_order_id" UNIQUE ("orderId"),
        CONSTRAINT "CHK_payments_amount" CHECK ("amount" > 0),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_payments_provider_transaction" ON "payments" ("provider", "transactionId")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_payments_provider_link" ON "payments" ("provider", "paymentLinkId") WHERE "paymentLinkId" IS NOT NULL',
    );
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "restaurantId" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" varchar(1000),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_order_id" UNIQUE ("orderId"),
        CONSTRAINT "CHK_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "FK_reviews_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_reviews_order_user" ON "reviews" ("orderId", "userId")',
    );
    await queryRunner.query(`
      CREATE TABLE "routes_search_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pointA" jsonb NOT NULL,
        "pointB" jsonb NOT NULL,
        "polyline" text NOT NULL,
        "radiusMeters" integer NOT NULL,
        "userId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routes_search_log" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "routes_search_log"');
    await queryRunner.query('DROP TABLE "reviews"');
    await queryRunner.query('DROP TABLE "payments"');
    await queryRunner.query('DROP TABLE "order_items"');
    await queryRunner.query('DROP TABLE "orders"');
    await queryRunner.query('DROP TABLE "menu_items"');
    await queryRunner.query('DROP INDEX "IDX_restaurants_location"');
    await queryRunner.query('DROP TABLE "restaurants"');
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "payments_status_enum"');
    await queryRunner.query('DROP TYPE "payments_provider_enum"');
    await queryRunner.query('DROP TYPE "orders_payment_status_enum"');
    await queryRunner.query('DROP TYPE "orders_status_enum"');
    await queryRunner.query('DROP TYPE "orders_type_enum"');
    await queryRunner.query('DROP TYPE "users_role_enum"');
  }
}
