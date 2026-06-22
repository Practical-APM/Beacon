import { closeDb } from '@beacon/db';
import { closeRedis } from '../lib/redis.js';

export default async function globalTeardown(): Promise<void> {
  await closeRedis();
  await closeDb();
}
