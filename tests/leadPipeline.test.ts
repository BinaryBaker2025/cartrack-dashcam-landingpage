import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import { createTestDatabase } from './d1Fixture';
import { googleWebhook } from '../lib/googleWebhook';
import { googleLeadMapper, type GoogleMappings } from '../lib/googleLeadMapper';
import { consumeLeads } from '../lib/leadConsumer';
import { recoverOutbox } from '../lib/leadService';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';
import { submitLead } from '../lib/leadbyte';

let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const queue = vi.fn();
const secret = 'synthetic-test-webhook-secret-at-least-32-characters';
const mappings: GoogleMappings = {
  '100': {
    answers: {
      age: { columnId: 'AGE', values: { Yes: '18_plus', No: 'under_18' } },
      vehicle: { columnId: 'VEHICLE', values: { Yes: 'yes', No: 'no' } },
      employment: { columnId: 'EMPLOYMENT', values: { Yes: 'employed', No: 'unemployed' } },
      income: { columnId: 'INCOME', values: { Yes: '10000_plus', No: 'under_10000' } },
      contactConsent: { columnId: 'CONTACT', values: { Yes: true, No: false } },
      marketingConsent: { columnId: 'MARKETING', values: { Yes: true, No: false } },
    },
    consentText: 'Synthetic test contact permission',
    consentVersion: 'test-v1',
  },
};
function payload(overrides: Record<string, unknown> = {}) {
  return {
    lead_id: 'synthetic-google-001',
    google_key: secret,
    form_id: 100,
    campaign_id: 200,
    adgroup_id: 300,
    creative_id: 400,
    lead_submit_time: '2026-09-20T10:00:00Z',
    user_column_data: Object.entries({
      FIRST_NAME: ' Test ',
      LAST_NAME: 'van der Testing',
      EMAIL: 'test@example.com ',
      PHONE_NUMBER: '0821234567',
      AGE: 'Yes',
      VEHICLE: 'Yes',
      EMPLOYMENT: 'Yes',
      INCOME: 'Yes',
      CONTACT: 'Yes',
      MARKETING: 'No',
    }).map(([column_id, string_value]) => ({ column_id, string_value })),
    ...overrides,
  };
}
function request(data: unknown = payload()) {
  return new Request('https://example.com/api/webhooks/google-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}
function row() {
  return db.sqlite.prepare('SELECT * FROM submissions').get()!;
}
function job(leadId = String(row().submission_key), queueName = 'bestcardash-leads') {
  const message = { id: crypto.randomUUID(), body: { leadId }, ack: vi.fn(), retry: vi.fn() };
  return {
    message,
    batch: { queue: queueName, messages: [message] } as unknown as MessageBatch<LeadJob>,
  };
}
beforeEach(() => {
  db = createTestDatabase();
  queue.mockReset();
  queue.mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send: queue },
    GOOGLE_ADS_WEBHOOK_KEY: secret,
    GOOGLE_ADS_FORM_MAPPINGS: JSON.stringify(mappings),
  } as unknown as LeadBindings;
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  vi.stubEnv('LEAD_HASH_SECRET', 'synthetic-test-secret-at-least-32-characters');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('maps identifiers, contact fields, exact answers and separate consent without inventing data', () => {
  expect(googleLeadMapper(payload(), mappings)).toMatchObject({
    source: 'GOOGLE_ADS',
    externalLeadId: 'synthetic-google-001',
    campaignId: '200',
    formId: '100',
    adGroupId: '300',
    adId: '400',
    contactConsent: true,
    marketingConsent: false,
    qualification: { age: '18_plus', vehicle: 'yes', employment: 'employed', income: '10000_plus' },
    consentVersion: 'test-v1',
  });
  expect(googleLeadMapper(payload(), {})).toMatchObject({
    contactConsent: null,
    marketingConsent: null,
    qualification: {},
  });
});
it('preserves multipart surnames and leaves a mononym incomplete', () => {
  const lead = (name: string) =>
    googleLeadMapper(
      payload({ user_column_data: [{ column_id: 'FULL_NAME', string_value: name }] }),
    );
  expect(lead('Test van der Testing')).toMatchObject({
    firstname: 'Test',
    lastname: 'van der Testing',
  });
  expect(lead('Test').lastname).toBeUndefined();
});
it('persists before queueing; queue and logs contain no customer data or credentials', async () => {
  queue.mockImplementation(async (message) => {
    expect(row().phone1).toBe('+27821234567');
    expect(db.sqlite.prepare('SELECT * FROM lead_outbox').get()).toBeTruthy();
    expect(Object.keys(message)).toEqual(['leadId']);
  });
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    email: 'test@example.com',
    processing_status: 'queued',
    marketing_consent: 0,
  });
  const event = db.sqlite.prepare('SELECT * FROM webhook_events').get()!;
  expect(event.processing_status).toBe('QUEUED');
  expect(String(event.payload_json)).not.toContain(secret);
  expect(String(event.payload_json)).toContain('PHONE_NUMBER');
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(
    /test@example.com|27821234567|synthetic-test-webhook/,
  );
});
it('deduplicates concurrent webhooks at database level and keeps each audit receipt', async () => {
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => googleWebhook(request(), env)),
  );
  expect(responses.every((r) => r.status === 200)).toBe(true);
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  expect(
    db.sqlite
      .prepare("SELECT count(*) n FROM webhook_events WHERE processing_status='DUPLICATE'")
      .get()?.n,
  ).toBe(9);
  expect(() =>
    db.sqlite
      .prepare(
        'INSERT INTO submissions(submission_key,fingerprint,created_at,expires_at,consent_version,source,external_lead_id) VALUES (?,?,?,?,?,?,?)',
      )
      .run('other', 'fp', 0, 0, '', 'GOOGLE_ADS', 'synthetic-google-001'),
  ).toThrow();
});
it.each([
  ['invalid authentication', payload({ google_key: 'wrong' }), 403],
  ['malformed JSON', '{', 400],
  ['oversize body', 'x'.repeat(66000), 400],
  ['invalid shape', payload({ user_column_data: null }), 400],
])('rejects %s', async (_name, data, status) => {
  expect((await googleWebhook(request(data), env)).status).toBe(status);
  expect(queue).not.toHaveBeenCalled();
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(0);
});
it('fails closed without configured key', async () => {
  env.GOOGLE_ADS_WEBHOOK_KEY = undefined;
  expect((await googleWebhook(request(), env)).status).toBe(503);
});
it('preserves 64-bit Google IDs without numeric rounding', async () => {
  const body = JSON.stringify(payload()).replace(
    '"campaign_id":200',
    '"campaign_id":9223372036854775807',
  );
  expect((await googleWebhook(request(body), env)).status).toBe(200);
  expect(row().source_campaign_id).toBe('9223372036854775807');
});
it('rolls back the lead when its transactional outbox cannot be written', async () => {
  db.sqlite.exec(
    "CREATE TRIGGER fail_outbox BEFORE INSERT ON lead_outbox BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  expect((await googleWebhook(request(), env)).status).toBe(503);
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(0);
  expect(queue).not.toHaveBeenCalled();
});
it('does not treat negative contact consent as permission', async () => {
  const body = payload();
  body.user_column_data.find((field) => field.column_id === 'CONTACT')!.string_value = 'No';
  await googleWebhook(request(body), env);
  expect(row()).toMatchObject({ processing_status: 'rejected', acceptterms: 'false' });
  expect(queue).not.toHaveBeenCalled();
});
it('does not send unrecognised qualification answers', async () => {
  const body = payload();
  body.user_column_data.find((field) => field.column_id === 'AGE')!.string_value = 'Maybe';
  await googleWebhook(request(body), env);
  expect(row().processing_status).toBe('pending_review');
  expect(queue).not.toHaveBeenCalled();
});
it('stores unmapped fields and unknown consent for review without queueing', async () => {
  env.GOOGLE_ADS_FORM_MAPPINGS = '{}';
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    processing_status: 'pending_review',
    acceptterms: null,
    marketing_consent: null,
  });
  expect(queue).not.toHaveBeenCalled();
});
it('unrecognised answer and absent consent version never qualify', async () => {
  const config = structuredClone(mappings);
  delete config['100'].consentVersion;
  env.GOOGLE_ADS_FORM_MAPPINGS = JSON.stringify(config);
  await googleWebhook(request(), env);
  expect(row().processing_status).toBe('pending_review');
  expect(queue).not.toHaveBeenCalled();
});
it('never delivers Google test leads even if completely qualified', async () => {
  await googleWebhook(request(payload({ is_test: true })), env);
  expect(row().processing_status).toBe('test');
  expect(queue).not.toHaveBeenCalled();
  const { batch, message } = job();
  const send = vi.fn();
  await consumeLeads(batch, env, send);
  expect(send).not.toHaveBeenCalled();
  expect(message.ack).toHaveBeenCalled();
});
it('returns 503 when durable persistence fails', async () => {
  db.sqlite.exec('DROP TABLE webhook_events');
  expect((await googleWebhook(request(), env)).status).toBe(503);
  expect(queue).not.toHaveBeenCalled();
});
it('recovers a failed queue send from durable outbox without a provider retry', async () => {
  queue.mockRejectedValueOnce(new Error('queue unavailable'));
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row().processing_status).toBe('pending');
  expect(db.sqlite.prepare('SELECT published_at FROM lead_outbox').get()?.published_at).toBeNull();
  await recoverOutbox(env);
  expect(row().processing_status).toBe('queued');
  expect(queue).toHaveBeenCalledTimes(2);
});
it('saves success and never sends again on concurrent or later delivery', async () => {
  await googleWebhook(request(), env);
  const send = vi
    .fn()
    .mockResolvedValue({
      state: 'success',
      message: 'Received',
      code: 1,
      leadId: 'synthetic-affiliate-1',
    });
  const a = job(),
    b = job();
  await Promise.all([consumeLeads(a.batch, env, send), consumeLeads(b.batch, env, send)]);
  await consumeLeads(job().batch, env, send);
  expect(send).toHaveBeenCalledTimes(1);
  expect(row()).toMatchObject({
    processing_status: 'accepted',
    leadbyte_lead_id: 'synthetic-affiliate-1',
  });
  expect(
    db.sqlite.prepare('SELECT processing_status FROM webhook_events').get()?.processing_status,
  ).toBe('PROCESSED');
});
it.each(['LEADBYTE_TIMEOUT', 'LEADBYTE_NETWORK_ERROR', 'LEADBYTE_HTTP_ERROR'])(
  'retries temporary %s with bounded backoff',
  async (diagnosticCode) => {
    await googleWebhook(request(), env);
    const send = vi
      .fn()
      .mockResolvedValue({
        state: 'temporary_error',
        message: 'Retry',
        diagnosticCode,
        uncertain: diagnosticCode !== 'LEADBYTE_HTTP_ERROR',
      });
    const { batch, message } = job();
    await consumeLeads(batch, env, send);
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(row()).toMatchObject({ processing_status: 'retry', retry_count: 1 });
  },
);
it.each([429, 500, 502, 503, 504, 400, 422, 401])(
  'classifies actual affiliate HTTP %i',
  async (status) => {
    const result = await submitLead(
      {
        firstname: 'Test',
        lastname: 'Testing',
        phone: '+27821234567',
        age: '18_plus',
        vehicle: 'yes',
        employment: 'employed',
        income: '10000_plus',
        terms: true,
        website: '',
        preferredtimeofcall: '',
      },
      new Date(),
      vi.fn().mockResolvedValue(new Response('{}', { status })),
    );
    expect(result.state).toBe(status === 429 || status >= 500 ? 'temporary_error' : 'api_rejected');
  },
);
it('stores permanent rejection and acknowledges without retrying', async () => {
  await googleWebhook(request(), env);
  const send = vi
    .fn()
    .mockResolvedValue({ state: 'api_rejected', message: 'Invalid phone', code: -8 });
  const { batch, message } = job();
  await consumeLeads(batch, env, send);
  await consumeLeads(job().batch, env, send);
  expect(message.ack).toHaveBeenCalled();
  expect(message.retry).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
  expect(row()).toMatchObject({ processing_status: 'rejected', leadbyte_code: -8 });
});
it('caps total sends and archives DLQ failures durably before acknowledgement', async () => {
  await googleWebhook(request(), env);
  const send = vi.fn().mockResolvedValue({ state: 'temporary_error', message: 'Retry', code: -3 });
  for (let i = 0; i < 8; i++) await consumeLeads(job().batch, env, send);
  expect(send).toHaveBeenCalledTimes(6);
  expect(row().processing_status).toBe('failed');
  const { batch, message } = job(String(row().submission_key), 'bestcardash-leads-dlq');
  await consumeLeads(batch, env, send);
  expect(row().processing_status).toBe('dead_letter');
  expect(message.ack).toHaveBeenCalled();
  expect(db.sqlite.prepare('SELECT count(*) n FROM lead_dead_letters').get()?.n).toBe(1);
});
it('does not resend after a consumer crashes while an affiliate call might have happened', async () => {
  await googleWebhook(request(), env);
  db.sqlite.exec("UPDATE submissions SET processing_status='processing',lease_until=1");
  const send = vi.fn();
  await consumeLeads(job().batch, env, send);
  expect(send).not.toHaveBeenCalled();
  expect(row().processing_status).toBe('uncertain');
});
