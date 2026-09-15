import type { D1Database } from '@cloudflare/workers-types';

export async function cleanupDatabase(db: D1Database, now = Date.now()) {
  await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now)]);
}
