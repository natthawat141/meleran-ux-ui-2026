import type { Clock, Db } from './db.ts';
import type { MockConfig, Route } from './http.ts';

export const paymentRoutes: Route[] = [];

export function createStripeSimulator(db: Db, clock: Clock, config: MockConfig) {
  void db; void clock; void config;
  return {};
}
