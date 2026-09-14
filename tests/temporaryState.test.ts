import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporaryStore } from '../lib/temporaryStore';
import { claimSubmission, completeSubmission } from '../lib/submissions';
import { rateLimit } from '../lib/rateLimit';
import { browserAttempt, browserReceipt, saveBrowserReceipt } from '../lib/browserState';
beforeEach(() => {
  const storage = new Map<string, string>([
    ['cartrack-temporary-state', JSON.stringify({ attempts: [], receipts: {} })],
  ]);
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('expires memory entries and rejects capacity overflow', () => {
  const store = new TemporaryStore<number>(1);
  expect(store.set('a', 1, 200, 100)).toBe(true);
  expect(store.set('b', 2, 200, 100)).toBe(false);
  expect(store.get('a', 200)).toBeUndefined();
  expect(store.set('b', 2, 400, 201)).toBe(true);
});
it('claims only once concurrently within a warm instance and replays results', async () => {
  const key = crypto.randomUUID();
  const results = await Promise.all([claimSubmission(key, 'hash'), claimSubmission(key, 'hash')]);
  expect(results.filter((r) => r.claimed)).toHaveLength(1);
  await completeSubmission(key, { state: 'success', message: 'Received' }, 200);
  const replay = await claimSubmission(key, 'hash');
  expect(!replay.claimed && replay.existing.httpStatus).toBe(200);
});
it('rate limits per client in temporary server memory', async () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'netlify');
  vi.stubEnv('RATE_LIMIT_MAX', '2');
  const req = new Request('https://example.com', {
    headers: { 'x-nf-client-connection-ip': '192.0.2.88' },
  });
  expect((await rateLimit(req)).allowed).toBe(true);
  expect((await rateLimit(req)).allowed).toBe(true);
  expect((await rateLimit(req)).allowed).toBe(false);
});
it('browser cooldown stops six attempts then expires', () => {
  for (let i = 0; i < 5; i++) expect(browserAttempt(1000000).allowed).toBe(true);
  expect(browserAttempt(1000000).allowed).toBe(false);
  expect(browserAttempt(1600001).allowed).toBe(true);
});
it('browser receipts retain outcome and attribution without contact fields and expire', () => {
  saveBrowserReceipt(
    'id',
    { state: 'success', message: 'Received' },
    { transaction_id: 'txn' },
    1000,
  );
  expect(browserReceipt('id', 1100)?.attribution.transaction_id).toBe('txn');
  expect(browserReceipt('id', 1100)).not.toHaveProperty('phone');
  expect(browserReceipt('id', 1801000)).toBeUndefined();
});
it('still works when browser storage is unavailable', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('disabled');
    },
    setItem: () => {
      throw new Error('disabled');
    },
  });
  expect(browserAttempt(Date.now()).allowed).toBe(true);
});
