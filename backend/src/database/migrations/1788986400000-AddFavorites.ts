import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavorites1788986400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "favorites" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "restaurantId" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_favorites" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_favorites_user_restaurant" UNIQUE ("userId", "restaurantId"),
      CONSTRAINT "FK_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_favorites_restaurant" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query('CREATE INDEX "IDX_favorites_restaurant" ON "favorites" ("restaurantId")');
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('DROP TABLE "favorites"'); }
}
