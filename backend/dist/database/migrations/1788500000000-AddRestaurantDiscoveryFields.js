"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRestaurantDiscoveryFields1788500000000 = void 0;
class AddRestaurantDiscoveryFields1788500000000 {
    constructor() {
        this.name = 'AddRestaurantDiscoveryFields1788500000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "category" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "imageUrl" text`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurants_active_category" ON "restaurants" ("active", "category")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_active_category"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "imageUrl"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "category"`);
    }
}
exports.AddRestaurantDiscoveryFields1788500000000 = AddRestaurantDiscoveryFields1788500000000;
//# sourceMappingURL=1788500000000-AddRestaurantDiscoveryFields.js.map