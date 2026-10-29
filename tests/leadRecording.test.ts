import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LeadResult } from '../lib/leadbyte';
import { createTestDatabase } from './d1Fixture';
import { valid } from './fixtures';
import { POST } from '../app/api/leads/route';
import { consumeLeads } from '../lib/leadConsumer';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';
import type { MessageBatch } from '@cloudflare/workers-types';

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDatabase> | null,
  submit: vi.fn(),
  queue: vi.fn(),
}));
vi.mock('../lib/database', () => ({
  database: async () => {
    if (!state.db) throw new Error('Unavailable');
    return state.db;
  },
}));
vi.mock('../lib/leadBindings', () => ({
  leadBindings: async () => ({ DB: state.db, LEAD_QUEUE: { send: state.queue } }),
}));
vi.mock('../lib/leadbyte', async (original) => ({
  ...(await original<typeof import('../lib/leadbyte')>()),
  submitLead: state.submit,
}));
beforeEach(() => {
  state.db = createTestDatabase();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('RATE_LIMIT_MAX', '100');
  vi.stubEnv('LEAD_HASH_SECRET', 'stable-test-secret-of-at-least-32-characters');
  state.submit.mockReset();
  state.queue.mockReset();
  state.queue.mockResolvedValue(undefined);
});
afterEach(() => {
  state.db?.sqlite.close();
  vi.unstubAllEnvs();
});
const token = 'c402a01d-3f0a-4a5c-a312-34f80b3d3a8d';
function request(overrides = {}) {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({
      ...valid,
      submissionId: token,
      attribution: {
        affiliate_id: 'affiliate',
        transaction_id: 'transaction',
        malicious: 'discard',
      },
      ...overrides,
    }),
  });
}
function row() {
  return state.db!.sqlite.prepare('SELECT * FROM lead_reporting').get()!;
}

it('serializes concurrent website submissions and rejects changed data with the same token', async () => {
  state.submit.mockResolvedValue({ state: 'success', message: 'Received', code: 1 });
  const responses = await Promise.all(Array.from({ length: 5 }, () => POST(request())));
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(state.db!.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  await deliver();
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect((await POST(request({ firstname: 'Changed' }))).status).toBe(409);
});

it('routes Bing website leads through the shared queue and affiliate service with separate acquisition data', async () => {
  const attribution = {
    utm_source: 'bing',
    utm_medium: 'cpc',
    utm_campaign: 'bestcardash_dashcam',
    msclkid: '0123456789abcdef0123456789abcdef',
    ms_campaign_id: '123',
    ms_adgroup_id: '456',
    ms_ad_id: '789',
  };
  state.submit.mockResolvedValue({
    state: 'success',
    message: 'Received',
    code: 1,
    leadId: 'vendor-123',
  });
  const response = await POST(request({ attribution }));
  expect(response.status).toBe(200);
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.queue).toHaveBeenCalledWith({ leadId: row().submission_key });
  expect(row()).toMatchObject({
    source: 'WEBSITE',
    consent_source: 'WEBSITE',
    marketing_consent: null,
    source_campaign_id: '123',
    campaign_id: 'DASHCAMS',
    ad_group_id: '456',
    ad_id: '789',
  });
  expect(JSON.parse(String(row().metadata_json)).acquisitionSource).toBe('MICROSOFT_ADS');
  const report = state.db!.sqlite.prepare('SELECT * FROM microsoft_ads_leads').get()!;
  expect(report.msclkid).toBe(attribution.msclkid);
  expect(report).not.toHaveProperty('phone1');
  expect(report).not.toHaveProperty('email');
  await deliver();
  expect(row().processing_status).toBe('accepted');
  expect(JSON.parse(String(row().payload_json))).not.toHaveProperty('msclkid');
  expect(state.submit.mock.calls[0][0]).not.toHaveProperty('msclkid');
  // Changing attribution must not create another lead/delivery for the same submission token.
  expect(
    (await POST(request({ attribution: { ...attribution, msclkid: 'a'.repeat(32) } }))).status,
  ).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect(state.db!.sqlite.prepare('SELECT msclkid FROM microsoft_ads_leads').get()?.msclkid).toBe(
    attribution.msclkid,
  );
});

it('does not let Bing tracking parameters bypass qualification or create marketing consent', async () => {
  const attribution = {
    utm_source: 'bing',
    utm_medium: 'cpc',
    terms: true,
    marketingConsent: true,
    msclkid: 'a'.repeat(32),
  };
  expect((await POST(request({ terms: false, attribution }))).status).toBe(422);
  expect((await POST(request({ age: 'under_18', attribution }))).status).toBe(422);
  expect(state.queue).not.toHaveBeenCalled();
  expect(state.db!.sqlite.prepare('SELECT count(*) n FROM microsoft_ads_leads').get()?.n).toBe(0);
});

async function deliver() {
  const env = { DB: state.db, LEAD_QUEUE: { send: state.queue } } as unknown as LeadBindings;
  const leadId = String(row().submission_key);
  await consumeLeads(
    {
      queue: 'bestcardash-leads',
      messages: [{ id: crypto.randomUUID(), body: { leadId }, ack: vi.fn(), retry: vi.fn() }],
    } as unknown as MessageBatch<LeadJob>,
    env,
  );
}

it('saves contact, consent, attribution and exact payload before sending, then saves vendor metadata', async () => {
  state.submit.mockImplementation(async () => {
    expect(row()).toMatchObject({
      firstname: valid.firstname,
      lastname: valid.lastname,
      phone1: valid.phone,
      delivery_status: 'pending',
      acceptterms: 'true',
      offer_id: '3046',
      campaign_id: 'DASHCAMS',
      supplier_id: '27144',
      affiliate_id: 'affiliate',
      transaction_id: 'transaction',
    });
    expect(JSON.parse(String(row().payload_json))).toMatchObject({
      phone1: valid.phone,
      offer_id: '3046',
      acceptterms: 'true',
    });
    expect(JSON.parse(String(row().attribution_json))).not.toHaveProperty('malicious');
    return {
      state: 'success',
      message: 'Received',
      code: 1,
      leadId: '123456',
      response: 'OK',
      info: [],
      processTime: 0.12,
      timestamp: '2026-09-15T12:00:00Z',
      upstreamStatus: 200,
      rawResponse: '{"code":1,"leadId":123456,"response":"OK"}',
    } satisfies LeadResult;
  });
  const response = await POST(request());
  expect(state.submit).not.toHaveBeenCalled();
  await deliver();
  expect(response.status).toBe(200);
  expect(row()).toMatchObject({
    delivery_status: 'accepted',
    leadbyte_code: 1,
    leadbyte_lead_id: '123456',
    leadbyte_info_json: '[]',
    leadbyte_process_time: 0.12,
    leadbyte_timestamp: '2026-09-15T12:00:00Z',
    upstream_http_status: 200,
    leadbyte_code_description: 'Accepted',
  });
  const publicResult = await response.json();
  expect(publicResult).not.toHaveProperty('phone1');
  expect(publicResult).not.toHaveProperty('leadId');
  expect(publicResult).not.toHaveProperty('info');
  expect((await POST(request())).status).toBe(200);
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect(state.db!.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count).toBe(
    1,
  );
});
it('retains email before delivery without adding it to the documented vendor payload', async () => {
  state.submit.mockImplementation(async () => {
    expect(row().email).toBe('visitor@example.com');
    const payload = JSON.parse(String(row().payload_json));
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('email1');
    return { state: 'success', message: 'Received', code: 1 };
  });
  expect((await POST(request({ email: 'visitor@example.com' }))).status).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
});

it('delivers a mononym with a whitespace surname', async () => {
  state.submit.mockImplementation(async (input: { firstname: string; lastname: string }) => {
    expect(input).toMatchObject({ firstname: 'Mononym', lastname: ' ' });
    return { state: 'success', message: 'Received', code: 1 };
  });
  expect((await POST(request({ name: 'Mononym' }))).status).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
});

it('rejects invalid email before recording or delivery', async () => {
  expect((await POST(request({ email: 'invalid' }))).status).toBe(422);
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.db!.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count).toBe(
    0,
  );
});

it.each([-9, -8, -7, -6, -5, -4, -3, -2, -19, -17, -16, -15, -14, -13, -12, -11, -100, -10])(
  'records failure code %i with its reporting description',
  async (code) => {
    state.submit.mockResolvedValue({
      state: code === -2 ? 'duplicate' : 'api_rejected',
      message: 'Rejected',
      code,
      response: 'HLR rejection',
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
    });
    await POST(request());
    await deliver();
    expect(row().leadbyte_code).toBe(code);
    expect(row().leadbyte_code_description).toBeTruthy();
    expect(row().delivery_status).toBe(code === -2 ? 'duplicate' : 'rejected');
    expect(JSON.parse(String(row().leadbyte_info_json))).toEqual({
      status: 'UNDELIV',
      code: 'EC_UNKNOWN_SUBSCRIBER',
    });
  },
);
it('retains a locally completed form when delivery is disabled, without calling LeadByte', async () => {
  vi.stubEnv('LEADBYTE_ENABLED', 'false');
  expect((await POST(request())).status).toBe(503);
  expect(row()).toMatchObject({
    phone1: valid.phone,
    delivery_status: 'not_sent_disabled',
    leadbyte_code: null,
  });
  expect(state.submit).not.toHaveBeenCalled();
});
it('keeps ambiguous vendor responses for reconciliation and does not redeliver on replay', async () => {
  state.submit.mockResolvedValue({
    state: 'temporary_error',
    message: 'Unknown',
    uncertain: true,
    diagnosticCode: 'LEADBYTE_MALFORMED_RESPONSE',
  });
  await POST(request());
  await deliver();
  await POST(request());
  await deliver();
  expect(row()).toMatchObject({
    delivery_status: 'uncertain',
    leadbyte_code: null,
    delivery_uncertain: 1,
  });
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it('preserves the pending lead if execution fails after recording', async () => {
  state.submit.mockRejectedValue(new Error('Lost execution'));
  expect((await POST(request())).status).toBe(200);
  await deliver();
  expect(row().delivery_status).toBe('uncertain');
  expect((await POST(request())).status).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it('does not send a lead when the record cannot be stored', async () => {
  state.db!.sqlite.exec('DROP VIEW lead_reporting; DROP TABLE submissions');
  expect((await POST(request())).status).toBe(503);
  expect(state.submit).not.toHaveBeenCalled();
});
it('groups daily reports by South African date rather than UTC date', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-09-15T22:30:00Z'));
    vi.stubEnv('LEADBYTE_ENABLED', 'false');
    await POST(request());
    expect(row()).toMatchObject({
      submitted_date_sa: '2026-09-16',
      optindate: '16/09/2026 00:30:00',
    });
    expect(
      state.db!.sqlite.prepare('SELECT submitted_date_sa, leads FROM lead_daily_summary').get(),
    ).toEqual({ submitted_date_sa: '2026-09-16', leads: 1 });
  } finally {
    vi.useRealTimers();
  }
});
