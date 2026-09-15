import { digest } from './logger';
import { clientAddress } from './hosting';
import { database } from './database';
export async function rateLimit(request: Request) {
  const configuredWindow = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 600);
  const configuredMax = Number(process.env.RATE_LIMIT_MAX || 10);
  const windowSeconds = Number.isFinite(configuredWindow)
    ? Math.min(86400, Math.max(60, Math.floor(configuredWindow)))
    : 600;
  const max = Number.isFinite(configuredMax) ? Math.max(1, Math.floor(configuredMax)) : 10;
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const key = digest('rate:' + clientAddress(request) + ':' + window);
  const expiresAt = (window + 1) * windowSeconds * 1000;
  const db = await database();
  // One SQL statement serializes concurrent requests across Worker instances.
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket_key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET count = MIN(rate_limits.count + 1, ?)
     RETURNING count`,
    )
    .bind(key, expiresAt, max + 1)
    .first<{ count: number }>();
  if (!row) throw new Error('Rate limit unavailable');
  return {
    allowed: row.count <= max,
    retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
}
