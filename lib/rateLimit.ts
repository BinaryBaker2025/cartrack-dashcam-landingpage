import { digest } from './logger';
import { clientAddress } from './hosting';
import { TemporaryStore } from './temporaryStore';
const buckets = new TemporaryStore<{ count: number; expiresAt: number }>();
export async function rateLimit(request: Request) {
  const windowSeconds = Math.max(60, Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 600);
  const max = Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 10);
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const key = digest('rate:' + clientAddress(request) + ':' + window);
  const row = buckets.get(key, now) || { count: 0, expiresAt: (window + 1) * windowSeconds * 1000 };
  row.count++;
  const saved = buckets.set(key, row, row.expiresAt, now);
  return {
    allowed: saved && row.count <= max,
    retryAfter: Math.max(1, Math.ceil((row.expiresAt - now) / 1000)),
  };
}
