"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackfillRestaurantDiscoveryData1788510000000 = void 0;
class BackfillRestaurantDiscoveryData1788510000000 {
    constructor() {
        this.name = 'BackfillRestaurantDiscoveryData1788510000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE "restaurants"
      SET "category" = CASE
        WHEN lower("name") LIKE '%cơm%' OR lower("name") LIKE '%com%' THEN 'com'
        WHEN lower("name") LIKE '%bún%' OR lower("name") LIKE '%bun%' OR lower("name") LIKE '%phở%' OR lower("name") LIKE '%pho%' THEN 'bun-pho'
        WHEN lower("name") LIKE '%cà phê%' OR lower("name") LIKE '%ca phe%' OR lower("name") LIKE '%coffee%' THEN 'ca-phe'
        WHEN lower("name") LIKE '%trà%' OR lower("name") LIKE '%tra %' OR lower("name") LIKE '%nước%' THEN 'do-uong'
        ELSE 'an-vat'
      END
      WHERE "category" IS NULL
    `);
        await queryRunner.query(`
      UPDATE "restaurants"
      SET "imageUrl" = CASE "category"
        WHEN 'com' THEN 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=900&q=80'
        WHEN 'bun-pho' THEN 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80'
        WHEN 'ca-phe' THEN 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80'
        WHEN 'do-uong' THEN 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80'
        ELSE 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80'
      END
      WHERE "imageUrl" IS NULL
    `);
    }
    async down() {
    }
}
exports.BackfillRestaurantDiscoveryData1788510000000 = BackfillRestaurantDiscoveryData1788510000000;
//# sourceMappingURL=1788510000000-BackfillRestaurantDiscoveryData.js.map