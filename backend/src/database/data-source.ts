import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entities } from './entities';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities,
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
});
