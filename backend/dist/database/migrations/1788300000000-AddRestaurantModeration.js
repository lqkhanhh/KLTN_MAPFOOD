"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRestaurantModeration1788300000000 = void 0;
class AddRestaurantModeration1788300000000 {
    constructor() {
        this.name = 'AddRestaurantModeration1788300000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'merchant'`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "suspendedReason" varchar(500)`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN "suspendedAt" timestamptz`);
        await queryRunner.query(`CREATE INDEX "IDX_restaurants_active_source" ON "restaurants" ("active", "source")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "IDX_restaurants_active_source"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "suspendedAt"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "suspendedReason"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "source"`);
    }
}
exports.AddRestaurantModeration1788300000000 = AddRestaurantModeration1788300000000;
//# sourceMappingURL=1788300000000-AddRestaurantModeration.js.map