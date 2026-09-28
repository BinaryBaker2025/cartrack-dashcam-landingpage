import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { createTestDatabase } from './d1Fixture';
import type { LeadBindings } from '../lib/leadBindings';
import {
  metaChallenge,
  receiveSocialWebhook,
  verifySocialSignature,
  type SocialProvider,
} from '../lib/socialWebhooks';
import { processSocialInbox } from '../lib/socialLeadProcessor';

const secret = 'synthetic-social-secret-at-least-32-characters';
let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const send = vi.fn();
const meta = {
  object: 'page',
  entry: [
    {
      id: '123',
      changes: [{ field: 'leadgen', value: { leadgen_id: '456', form_id: '789', page_id: '123' } }],
    },
  ],
};
const tiktok = {
  object: 1,
  entry: [
    {
      id: '456',
      advertiser_id: '123',
      page_id: '789',
      lead_source: 'INSTANT_FORM',
      create_time: 1789999200,
      changes: [
        { field: 'name', value: 'Test van der Example' },
        { field: 'email', value: 'test@example.com' },
        { field: 'phone_number', value: '0821234567' },
      ],
    },
  ],
};
function request(
  provider: SocialProvider,
  data: unknown,
  time = Math.floor(Date.now() / 1000),
  key = secret,
) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const signature =
    provider === 'META_ADS'
      ? `sha256=${createHmac('sha256', key).update(body).digest('hex')}`
      : `t=${time},s=${createHmac('sha256', key).update(`${time}.${body}`).digest('hex')}`;
  return new Request('https://bestcardash.com/api/webhooks/social', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [provider === 'META_ADS' ? 'x-hub-signature-256' : 'tiktok-signature']: signature,
    },
    body,
  });
}
const inbox = () => db.sqlite.prepare('SELECT * FROM social_webhook_inbox').get()!;
const lead = () => db.sqlite.prepare('SELECT * FROM submissions').get()!;
beforeEach(() => {
  db = createTestDatabase();
  send.mockReset().mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send },
    META_APP_SECRET: secret,
    META_VERIFY_TOKEN: secret,
    META_PAGE_ID: '123',
    META_PAGE_ACCESS_TOKEN: 'synthetic-token',
    META_GRAPH_VERSION: 'v25.0',
    TIKTOK_APP_SECRET: secret,
    TIKTOK_ADVERTISER_ID: '123',
  } as unknown as LeadBindings;
  vi.stubEnv('LEAD_HASH_SECRET', secret);
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('verifies Meta subscription challenges without storing leads', async () => {
  expect(
    await metaChallenge(
      new Request(
        `https://bestcardash.com/api/webhooks/meta?hub.mode=subscribe&hub.challenge=1234&hub.verify_token=${secret}`,
      ),
      env,
    ).text(),
  ).toBe('1234');
  expect(
    metaChallenge(
      new Request(
        'https://bestcardash.com/api/webhooks/meta?hub.mode=subscribe&hub.challenge=1234&hub.verify_token=wrong',
      ),
      env,
    ).status,
  ).toBe(403);
});
it.each(['META_ADS', 'TIKTOK_ADS'] as const)(
  'rejects forged %s notifications before storing anything',
  async (provider) => {
    expect(
      (
        await receiveSocialWebhook(
          request(provider, provider === 'META_ADS' ? meta : tiktok, undefined, 'wrong'),
          env,
          provider,
        )
      ).status,
    ).toBe(403);
    expect(inbox()).toBeUndefined();
  },
);
it.each([-301, 301])('rejects stale or future TikTok delivery timestamps (%s)', async (offset) => {
  expect(
    (
      await receiveSocialWebhook(
        request('TIKTOK_ADS', tiktok, Math.floor(Date.now() / 1000) + offset),
        env,
        'TIKTOK_ADS',
      )
    ).status,
  ).toBe(403);
});
it('verifies exact raw bytes, not reserialized JSON', () => {
  const body = Buffer.from('{ "test": true }');
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  expect(verifySocialSignature('META_ADS', body, signature, secret)).toBe(true);
  expect(verifySocialSignature('META_ADS', Buffer.from('{"test":true}'), signature, secret)).toBe(
    false,
  );
});
it.each([
  '{',
  '[]',
  JSON.stringify({ object: 1, entry: [] }),
  JSON.stringify({ padding: 'x'.repeat(66000) }),
])('rejects invalid or oversized payloads', async (body) => {
  expect((await receiveSocialWebhook(request('TIKTOK_ADS', body), env, 'TIKTOK_ADS')).status).toBe(
    400,
  );
});
it('rejects notifications from other advertisers', async () => {
  env.TIKTOK_ADVERTISER_ID = '999';
  expect(
    (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
  ).toBe(400);
  expect(inbox()).toBeUndefined();
});
it('requires a durable receipt before acknowledging and deduplicates repeated notifications', async () => {
  for (let i = 0; i < 2; i++)
    expect(
      (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
    ).toBe(200);
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM social_webhook_inbox').get()?.n).toBe(1);
  vi.spyOn(db, 'prepare').mockImplementation(() => {
    throw new Error('db offline');
  });
  expect(
    (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
  ).toBe(503);
});
it('processes native TikTok leads in test mode without affiliate delivery', async () => {
  await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS');
  await processSocialInbox(env);
  expect(inbox().status).toBe('processed');
  expect(lead()).toMatchObject({
    source: 'TIKTOK_ADS',
    external_lead_id: '456',
    lastname: 'van der Example',
    processing_status: 'test',
  });
  expect(send).not.toHaveBeenCalled();
});
it('preserves TikTok numeric IDs beyond JavaScript safe integer range', async () => {
  env.TIKTOK_ADVERTISER_ID = '7123456789012345678';
  const raw = JSON.stringify(tiktok).replace(
    '"advertiser_id":"123"',
    '"advertiser_id":7123456789012345678',
  );
  expect((await receiveSocialWebhook(request('TIKTOK_ADS', raw), env, 'TIKTOK_ADS')).status).toBe(
    200,
  );
  await processSocialInbox(env);
  expect(JSON.parse(String(lead().metadata_json)).accountId).toBe('7123456789012345678');
});
it('fetches Meta details privately and maps the native form', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: '456',
        form_id: '789',
        created_time: '2026-09-21T14:00:00+0000',
        field_data: [
          { name: 'full_name', values: ['Test van der Example'] },
          { name: 'email', values: ['test@example.com'] },
        ],
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  await receiveSocialWebhook(request('META_ADS', meta), env, 'META_ADS');
  await processSocialInbox(env);
  expect(inbox().status).toBe('processed');
  expect(lead()).toMatchObject({
    source: 'META_ADS',
    processing_status: 'test',
    external_lead_id: '456',
  });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token');
  expect(String(fetcher.mock.calls[0][0])).not.toContain('synthetic-token');
});
it('retries Meta fetch errors and recovers without losing the notification', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await receiveSocialWebhook(request('META_ADS', meta), env, 'META_ADS');
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({
    status: 'pending',
    attempts: 1,
    error_code: 'PROCESSING_FAILED',
  });
  expect(lead()).toBeUndefined();
});
it('checkpoints large batches and resumes without inserting duplicates', async () => {
  await receiveSocialWebhook(
    request('TIKTOK_ADS', {
      object: 1,
      entry: Array.from({ length: 7 }, (_, i) => ({ ...tiktok.entry[0], id: String(100 + i) })),
    }),
    env,
    'TIKTOK_ADS',
  );
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({ status: 'pending', cursor: 5 });
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({ status: 'processed', cursor: 7 });
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM submissions').get()?.n).toBe(7);
});
it('queues a qualified live lead once across different notifications and preserves unknown consent', async () => {
  env.SOCIAL_LEADS_TEST_MODE = 'false';
  const answers = Object.fromEntries(
    Object.entries({
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      contactConsent: true,
    }).map(([key, value]) => [key, { columnId: key, values: { answer: value } }]),
  );
  env.TIKTOK_FORM_MAPPINGS = JSON.stringify({
    '789': { answers, consentText: 'Synthetic permission', consentVersion: 'test-v1' },
  });
  const changes = [
    ...tiktok.entry[0].changes,
    ...Object.keys(answers).map((field) => ({ field, value: 'answer' })),
  ];
  for (const time of [1, 2]) {
    await receiveSocialWebhook(
      request('TIKTOK_ADS', { object: 1, time, entry: [{ ...tiktok.entry[0], changes }] }),
      env,
      'TIKTOK_ADS',
    );
    await processSocialInbox(env);
  }
  expect(lead().processing_status).toBe('queued');
  expect(send).toHaveBeenCalledTimes(1);
  await receiveSocialWebhook(
    request('TIKTOK_ADS', { object: 1, entry: [{ ...tiktok.entry[0], id: '999' }] }),
    env,
    'TIKTOK_ADS',
  );
  await processSocialInbox(env);
  expect(
    db.sqlite
      .prepare("SELECT processing_status,acceptterms FROM submissions WHERE external_lead_id='999'")
      .get(),
  ).toMatchObject({ processing_status: 'pending_review', acceptterms: null });
  expect(send).toHaveBeenCalledTimes(1);
});
