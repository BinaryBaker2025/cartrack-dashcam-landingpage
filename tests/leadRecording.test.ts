import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LeadResult } from '../lib/leadbyte';
import { createTestDatabase } from './d1Fixture';
import { valid } from './fixtures';
import { POST } from '../app/api/leads/route';

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDatabase> | null,
  submit: vi.fn(),
}));
vi.mock('../lib/database', () => ({
  database: async () => {
    if (!state.db) throw new Error('Unavailable');
    return state.db;
  },
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
it('keeps timeouts for reconciliation and does not redeliver on replay', async () => {
  state.submit.mockResolvedValue({
    state: 'temporary_error',
    message: 'Unknown',
    uncertain: true,
    diagnosticCode: 'LEADBYTE_TIMEOUT',
  });
  await POST(request());
  await POST(request());
  expect(row()).toMatchObject({
    delivery_status: 'uncertain',
    leadbyte_code: null,
    delivery_uncertain: 1,
  });
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it('preserves the pending lead if execution fails after recording', async () => {
  state.submit.mockRejectedValue(new Error('Lost execution'));
  expect((await POST(request())).status).toBe(503);
  expect(row().delivery_status).toBe('pending');
  expect((await POST(request())).status).toBe(409);
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
