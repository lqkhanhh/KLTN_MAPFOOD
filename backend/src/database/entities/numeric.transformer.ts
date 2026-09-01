import { ValueTransformer } from 'typeorm';

/** PostgreSQL numeric is returned as a string; monetary values are integer VND. */
export const integerMoneyTransformer: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string | number) => (value == null ? 0 : Number(value)),
};
