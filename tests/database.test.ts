import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestDatabase } from './d1Fixture';
import { claimSubmission, completeSubmission } from '../lib/submissions';
import { rateLimit } from '../lib/rateLimit';
import { digest } from '../lib/logger';
import { cleanupDatabase } from '../lib/databaseMaintenance';
import type { D1Database } from '@cloudflare/workers-types';

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof createTestDatabase> | null }));
vi.mock('../lib/database', () => ({
  database: async () => {
    if (!state.db) throw new Error('Database unavailable');
    return state.db;
  },
}));
beforeEach(() => {
  state.db = createTestDatabase();
});
afterEach(() => {
  state.db?.sqlite.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('serializes concurrent attempts and preserves the original fingerprint', async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => claimSubmission('same', `fingerprint-${i}`)),
  );
  expect(results.filter((result) => result.claimed)).toHaveLength(1);
  const replay = await claimSubmission('same', 'changed');
  expect(!replay.claimed && replay.existing.fingerprint).toBe('fingerprint-0');
});
it('keeps pending deliveries claimed beyond the old 30-minute memory window', async () => {
  vi.useFakeTimers();
  await claimSubmission('pending', 'fingerprint');
  vi.advanceTimersByTime(60 * 60 * 1000);
  expect((await claimSubmission('pending', 'fingerprint')).claimed).toBe(false);
});
it('never overwrites a completed outcome', async () => {
  await claimSubmission('done', 'fingerprint');
  await completeSubmission('done', { state: 'success', message: 'Received' }, 200);
  await expect(
    completeSubmission('done', { state: 'temporary_error', message: 'Failed' }, 503),
  ).rejects.toThrow();
  const replay = await claimSubmission('done', 'fingerprint');
  expect(!replay.claimed && replay.existing.httpStatus).toBe(200);
});
it('enforces a shared concurrent rate limit and resets in a new window', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  vi.stubEnv('DEPLOY_PLATFORM', 'cloudflare');
  vi.stubEnv('RATE_LIMIT_MAX', '3');
  const request = new Request('https://example.com', {
    headers: { 'cf-connecting-ip': '192.0.2.1' },
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(request)));
  expect(results.filter((result) => result.allowed)).toHaveLength(3);
  vi.advanceTimersByTime(600000);
  expect((await rateLimit(request)).allowed).toBe(true);
});
it('fails closed when the database cannot be reached', async () => {
  state.db?.sqlite.close();
  state.db = null;
  await expect(claimSubmission('key', 'fp')).rejects.toThrow();
  await expect(rateLimit(new Request('https://example.com'))).rejects.toThrow();
});
it('uses a stable configured hash secret and refuses missing production secrets', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LEAD_HASH_SECRET', 'a-stable-test-secret-of-at-least-32-characters');
  expect(digest('same')).toBe(digest('same'));
  vi.stubEnv('LEAD_HASH_SECRET', '');
  expect(() => digest('same')).toThrow('CONFIG_HASH_SECRET_REQUIRED');
});
it('daily cleanup removes rate buckets but preserves lead history and pending claims', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  await claimSubmission('old-pending', 'fingerprint');
  await rateLimit(new Request('https://example.com'));
  vi.advanceTimersByTime(365 * 86400000);
  await claimSubmission('new-pending', 'fingerprint');
  await cleanupDatabase(state.db as unknown as D1Database);
  expect(state.db?.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()).toEqual({
    count: 2,
  });
  expect(state.db?.sqlite.prepare('SELECT * FROM rate_limits').all()).toHaveLength(0);
});
