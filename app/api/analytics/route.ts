import { database } from '@/lib/database';
import { clientAddress } from '@/lib/hosting';
import { digest } from '@/lib/logger';
import type { ValidationFailure } from '@/lib/analytics';

const events = new Set([
  'landing_page_view',
  'form_started',
  'qualification_failed',
  'form_validation_failed',
  'lead_submit_started',
  'lead_submit_success',
  'lead_submit_rejected',
  'lead_submit_error',
]);
function parseFailures(value: unknown): ValidationFailure[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const failures: ValidationFailure[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { field, reason } = item as { field?: unknown; reason?: unknown };
    if ((field === 'name' || field === 'mobile') && reason === 'format') {
      failures.push({ field, reason });
    } else if ((field === 'eligibility' || field === 'consent') && reason === 'required') {
      failures.push({ field, reason });
    } else if (field === 'honeypot' && reason === 'filled') {
      failures.push({ field, reason });
    } else {
      return null;
    }
  }
  return failures;
}
export async function POST(request: Request) {
  const response = (status: number) =>
    new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return response(403);
  if (Number(request.headers.get('content-length')) > 512) return response(413);
  try {
    const reader = request.body?.getReader();
    if (!reader) return response(400);
    let body = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 512) {
        await reader.cancel();
        return response(413);
      }
      body += decoder.decode(part.value, { stream: true });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return response(400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return response(400);
    const { event, failures: rawFailures } = payload as {
      event?: unknown;
      failures?: unknown;
    };
    if (typeof event !== 'string' || !events.has(event)) return response(400);
    let failures: ValidationFailure[] = [];
    if (rawFailures !== undefined) {
      if (event !== 'form_validation_failed') return response(400);
      const parsed = parseFailures(rawFailures);
      if (!parsed) return response(400);
      failures = parsed;
    }
    const db = await database();
    const now = Date.now();
    const expiry = (Math.floor(now / 60000) + 1) * 60000;
    const key = digest(`analytics:${clientAddress(request)}:${expiry}`);
    const limit = await db
      .prepare(
        'INSERT INTO rate_limits (bucket_key,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET count=MIN(count+1,61) RETURNING count',
      )
      .bind(key, expiry)
      .first<{ count: number }>();
    if (!limit || limit.count > 60) return response(429);
    const day = new Date(now + 7200000).toISOString().slice(0, 10);
    await db.batch([
      db
        .prepare(
          'INSERT INTO site_event_daily (day,event,count) VALUES (?,?,1) ON CONFLICT(day,event) DO UPDATE SET count=count+1',
        )
        .bind(day, event),
      ...failures.map((failure) =>
        db
          .prepare(
            'INSERT INTO site_validation_failure_daily (day,field,reason,count) VALUES (?,?,?,1) ON CONFLICT(day,field,reason) DO UPDATE SET count=count+1',
          )
          .bind(day, failure.field, failure.reason),
      ),
    ]);
    return response(204);
  } catch {
    return response(503);
  }
}
