import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rateLimit: vi.fn(), ingest: vi.fn() }));
vi.mock('../lib/rateLimit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('../lib/leadBindings', () => ({ leadBindings: async () => ({}) }));
vi.mock('../lib/leadService', async (original) => ({
  ...(await original<typeof import('../lib/leadService')>()),
  ingestLead: mocks.ingest,
}));
import { POST } from '../app/api/leads/route';
import { LeadConflict } from '../lib/leadService';
import { valid } from './fixtures';
function request(body: unknown = valid, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      ...valid,
      submissionId: 'c402a01d-3f0a-4a5c-a312-34f80b3d3a8d',
      ...(body as object),
    }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('LEAD_HASH_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.ingest.mockResolvedValue({ status: 'queued' });
});
afterEach(() => vi.unstubAllEnvs());
it('uses common service with website consent and qualification, ignoring offer overrides', async () => {
  const response = await POST(request({ ...valid, offer_id: '999' }));
  expect(response.status).toBe(200);
  expect(mocks.ingest.mock.calls[0][1]).toMatchObject({
    source: 'WEBSITE',
    contactConsent: true,
    marketingConsent: null,
  });
  expect(mocks.ingest.mock.calls[0][1]).not.toHaveProperty('offer_id');
  expect((await response.json()).diagnostics.code).toBe('LEAD_RECEIVED');
});
it.each([
  ['age', 'under_18'],
  ['vehicle', 'no'],
  ['employment', 'unemployed'],
  ['income', 'under_10000'],
  ['terms', false],
  ['phone', '123'],
  ['email', 'invalid'],
])('rejects invalid %s', async (key, value) => {
  expect((await POST(request({ [key]: value }))).status).toBe(422);
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it('rejects honeypot', async () =>
  expect((await POST(request({ website: 'spam' }))).status).toBe(400));
it('rejects cross origin', async () =>
it('blocks honeypot bots', async () => {
  expect((await POST(request({ ...valid, website: 'spam' }))).status).toBe(400);
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
it('accepts the production site when using either apex or www origin', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  const response = await POST(request(valid, 'https://www.bestcardash.com'));
  expect(response.status).toBe(200);
});
it('blocks cross-origin submissions', async () =>
  expect((await POST(request(valid, 'https://elsewhere.example'))).status).toBe(403));
it('retains rate limiting', async () => {
  mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('30');
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it('rejects oversized body', async () =>
  expect((await POST(request({ extra: 'x'.repeat(17000) }))).status).toBe(400));
it('rejects malformed JSON', async () => {
  const response = await POST(
    new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: '{',
    }),
  );
  expect(response.status).toBe(400);
});
it('rejects conflicting tokens', async () => {
  mocks.ingest.mockRejectedValue(new LeadConflict());
  expect((await POST(request())).status).toBe(409);
});
it('replays historical receipts', async () => {
  mocks.ingest.mockResolvedValue({
    legacyResult: {
      result: JSON.stringify({ state: 'success', message: 'Received' }),
      http_status: 200,
    },
  });
  expect((await POST(request())).status).toBe(200);
});
it('does not expose persistence exceptions', async () => {
  mocks.ingest.mockRejectedValue(new Error('private customer details'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private customer');
});
