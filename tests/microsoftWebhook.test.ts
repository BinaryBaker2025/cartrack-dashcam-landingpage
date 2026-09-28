import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import { createTestDatabase } from './d1Fixture';
import { microsoftWebhook } from '../lib/microsoftWebhook';
import { microsoftLeadMapper } from '../lib/microsoftLeadMapper';
import { consumeLeads } from '../lib/leadConsumer';
import { recoverOutbox } from '../lib/leadService';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';

const secret = 'synthetic-microsoft-secret-at-least-32-characters';
let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const sendQueue = vi.fn();
const payload = (extra: Record<string, unknown> = {}) => ({
  source: 'microsoft_ads',
  externalLeadId: 'crm:test-001',
  fullName: '  Test van der Example  ',
  email: 'test@example.com',
  phone: '0821234567',
  campaignId: '123',
  adId: '456',
  submittedAt: '2026-09-21T14:00:00Z',
  ...extra,
});
const qualified = () =>
  payload({
    qualification: { age: '18_plus', vehicle: 'yes', employment: 'employed', income: '10000_plus' },
    contactConsent: true,
    marketingConsent: false,
    consentText: 'Synthetic contact permission',
    consentVersion: 'test-v1',
    consentTimestamp: '2026-09-21T14:00:00Z',
  });
function request(data: unknown = payload(), token = secret) {
  return new Request('https://bestcardash.com/api/webhooks/microsoft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}
const row = () => db.sqlite.prepare('SELECT * FROM submissions').get()!;
beforeEach(() => {
  db = createTestDatabase();
  sendQueue.mockReset().mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send: sendQueue },
    MICROSOFT_ADS_WEBHOOK_TOKEN: secret,
  } as unknown as LeadBindings;
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('LEAD_HASH_SECRET', 'synthetic-test-hash-secret-at-least-32-characters');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('preserves original full name, derives multipart surname and prefers explicit names', () => {
  expect(microsoftLeadMapper(payload())).toMatchObject({
    firstname: 'Test',
    lastname: 'van der Example',
    metadata: { fullName: '  Test van der Example  ' },
  });
  expect(
    microsoftLeadMapper(payload({ firstName: 'Test van', lastName: 'der Example' })),
  ).toMatchObject({ firstname: 'Test van', lastname: 'der Example' });
  expect(microsoftLeadMapper(payload({ fullName: 'Mononym' })).lastname).toBeUndefined();
});
it('stores incomplete leads for review, audit and unknown consent without queueing', async () => {
  expect((await microsoftWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    source: 'MICROSOFT_ADS',
    processing_status: 'pending_review',
    acceptterms: null,
    marketing_consent: null,
    phone1: '+27821234567',
  });
  expect(JSON.parse(String(row().metadata_json)).fullName).toBe('  Test van der Example  ');
  const event = db.sqlite.prepare('SELECT * FROM webhook_events').get()!;
  expect(JSON.parse(String(event.payload_json))).toEqual(payload());
  expect(event.received_at).toBeTypeOf('number');
  expect(sendQueue).not.toHaveBeenCalled();
});
it('persists before queueing and deduplicates intermediary retries at database level', async () => {
  sendQueue.mockImplementation(async ({ leadId }) => {
    expect(row().submission_key).toBe(leadId);
  });
  await microsoftWebhook(request(qualified()), env);
  const response = await microsoftWebhook(request(qualified()), env);
  expect(await response.json()).toMatchObject({ duplicate: true });
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  expect(
    db.sqlite
      .prepare("SELECT count(*) n FROM webhook_events WHERE processing_status='DUPLICATE'")
      .get()?.n,
  ).toBe(1);
  expect(sendQueue).toHaveBeenCalledTimes(1);
  expect(sendQueue).toHaveBeenCalledWith({ leadId: row().submission_key });
});
it.each(['', 'wrong-secret'])(
  'rejects invalid authentication without storing PII (%s)',
  async (token) => {
    expect((await microsoftWebhook(request(payload(), token), env)).status).toBe(401);
    expect(db.sqlite.prepare('SELECT count(*) n FROM webhook_events').get()?.n).toBe(0);
  },
);
it.each(['{', '[]', JSON.stringify({ note: 'x'.repeat(66000) })])(
  'rejects malformed or oversized JSON',
  async (body) => {
    expect((await microsoftWebhook(request(body), env)).status).toBe(400);
  },
);
it.each([
  { externalLeadId: undefined },
  { externalLeadId: 123 },
  { fullName: undefined },
  { source: 'google_ads' },
  { contactConsent: 'true' },
  { submittedAt: 'yesterday' },
  { qualification: [] },
  { email: undefined, phone: undefined },
])('rejects invalid contract fields and records a safe audit failure', async (extra) => {
  expect((await microsoftWebhook(request(payload(extra)), env)).status).toBe(400);
  expect(db.sqlite.prepare('SELECT error_message FROM webhook_events').get()?.error_message).toBe(
    'INVALID_PAYLOAD',
  );
  expect(sendQueue).not.toHaveBeenCalled();
});
it('redacts secrets in audit payloads and never logs contact data', async () => {
  await microsoftWebhook(
    request(payload({ apiKey: 'private', nested: { token: secret }, note: secret })),
    env,
  );
  const audit = String(
    db.sqlite.prepare('SELECT payload_json FROM webhook_events').get()?.payload_json,
  );
  expect(audit).not.toContain(secret);
  expect(audit).not.toContain('private');
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/test@example|0821234567/);
});
it('recovers queue failure from the durable outbox', async () => {
  sendQueue.mockRejectedValueOnce(new Error('offline'));
  expect((await microsoftWebhook(request(qualified()), env)).status).toBe(200);
  expect(row().processing_status).toBe('pending');
  await recoverOutbox(env);
  expect(row().processing_status).toBe('queued');
});
it('returns 503 when the database cannot record the lead', async () => {
  vi.spyOn(db, 'prepare').mockImplementation(() => {
    throw new Error('private database details');
  });
  const response = await microsoftWebhook(request(), env);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private');
});
it.each([
  ['success', 'accepted', false],
  ['temporary_error', 'retry', true],
  ['api_rejected', 'rejected', false],
] as const)('uses the shared affiliate consumer for %s', async (state, status, retry) => {
  await microsoftWebhook(request(qualified()), env);
  const message = {
    id: 'test-message',
    body: { leadId: String(row().submission_key) },
    ack: vi.fn(),
    retry: vi.fn(),
  };
  const batch = {
    queue: 'bestcardash-leads',
    messages: [message],
  } as unknown as MessageBatch<LeadJob>;
  const send = vi
    .fn()
    .mockResolvedValue({
      state,
      message: 'Synthetic response',
      code: state === 'success' ? 1 : -8,
      leadId: 'test-affiliate-1',
    });
  await consumeLeads(batch, env, send);
  expect(row().processing_status).toBe(status);
  expect(retry ? message.retry : message.ack).toHaveBeenCalled();
  if (!retry) {
    await consumeLeads(batch, env, send);
    expect(send).toHaveBeenCalledTimes(1);
  }
  expect(db.sqlite.prepare('SELECT count(*) n FROM lead_attempts').get()?.n).toBe(1);
});
it('never queues tests or leads without verified contact consent and evidence', async () => {
  for (const [index, extra] of [
    { isTest: true },
    { contactConsent: null },
    { consentVersion: undefined },
    { qualification: {} },
  ].entries()) {
    await microsoftWebhook(
      request({ ...qualified(), ...extra, externalLeadId: `test-${index}` }),
      env,
    );
  }
  expect(sendQueue).not.toHaveBeenCalled();
});
