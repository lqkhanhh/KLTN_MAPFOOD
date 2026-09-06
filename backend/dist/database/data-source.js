"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const entities_1 = require("./entities");
exports.default = new typeorm_1.DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: entities_1.entities,
    migrations: [`${__dirname}/migrations/*{.ts,.js}`],
    synchronize: false,
});
//# sourceMappingURL=data-source.js.map