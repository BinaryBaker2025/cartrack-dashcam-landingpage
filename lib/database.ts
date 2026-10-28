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
    db.prepare(
      'SELECT request_id, delivery_status, leadbyte_code, email FROM lead_reporting LIMIT 0',
    ),
    db.prepare('SELECT bucket_key FROM rate_limits LIMIT 0'),
    db.prepare('SELECT source, processing_status FROM submissions LIMIT 0'),
    db.prepare('SELECT lead_id FROM lead_outbox LIMIT 0'),
    db.prepare('SELECT id FROM webhook_events LIMIT 0'),
    db.prepare('SELECT day, field, reason FROM site_validation_failure_daily LIMIT 0'),
  ]);
}
