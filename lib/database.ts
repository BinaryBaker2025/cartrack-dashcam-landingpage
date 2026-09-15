import type { D1Database } from '@cloudflare/workers-types';
import { ConfigurationError } from './diagnostics';

export async function database(): Promise<D1Database> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) throw new Error('Missing DB binding');
    return db;
  } catch {
    throw new ConfigurationError('DATABASE_UNAVAILABLE');
  }
}

export async function checkDatabase() {
  const db = await database();
  // Check both migrations and binding connectivity without exposing stored data.
  await db.batch([
    db.prepare('SELECT request_id, delivery_status, leadbyte_code FROM lead_reporting LIMIT 0'),
    db.prepare('SELECT bucket_key FROM rate_limits LIMIT 0'),
  ]);
}
