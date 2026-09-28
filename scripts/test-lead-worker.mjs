// Real local workerd + D1 + Queue; all outbound requests are intercepted.
// Uses the Miniflare version bundled with the installed Wrangler.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const bundle = await build({
  stdin: {
    contents: `import worker from './worker.mjs';
    import { googleWebhook } from './lib/googleWebhook';
    import { microsoftWebhook } from './lib/microsoftWebhook';
    export default { ...worker, fetch(request, env) {
      return new URL(request.url).pathname === '/api/webhooks/microsoft'
        ? microsoftWebhook(request, env) : googleWebhook(request, env);
    } };`,
    resolveDir: process.cwd(),
    sourcefile: 'pipeline-runtime-test.ts',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  external: ['node:*'],
  plugins: [
    {
      name: 'next-fetch-shim',
      setup(builder) {
        builder.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({
          path: 'next-shim',
          namespace: 'test',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents:
            'export default {fetch(){throw new Error("Next fetch is tested separately")}}; export class DOQueueHandler{}; export class DOShardedTagCache{}; export class BucketCachePurge{};',
        }));
      },
    },
  ],
});
const key = 'synthetic-local-worker-key-at-least-32-characters';
const answers = Object.fromEntries(
  Object.entries({
    age: '18_plus',
    vehicle: 'yes',
    employment: 'employed',
    income: '10000_plus',
    contactConsent: true,
  }).map(([field, value]) => [field, { columnId: field, values: { Yes: value } }]),
);
let affiliateCalls = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'pipeline-test',
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          LEADBYTE_ENABLED: 'true',
          NEXT_PUBLIC_SITE_URL: 'https://example.com',
          LEAD_HASH_SECRET: 'synthetic-hash-secret-at-least-32-characters',
          GOOGLE_ADS_WEBHOOK_KEY: key,
          MICROSOFT_ADS_WEBHOOK_TOKEN: key,
          GOOGLE_ADS_FORM_MAPPINGS: JSON.stringify({
            100: {
              answers,
              consentText: 'Synthetic contact permission',
              consentVersion: 'test-v1',
            },
          }),
        },
        d1Databases: ['DB'],
        queueProducers: { LEAD_QUEUE: 'bestcardash-leads' },
        queueConsumers: {
          'bestcardash-leads': {
            maxBatchSize: 1,
            maxBatchTimeout: 0,
            maxRetries: 5,
            deadLetterQueue: 'bestcardash-leads-dlq',
          },
          'bestcardash-leads-dlq': { maxBatchSize: 1, maxBatchTimeout: 0 },
        },
        outboundService(request) {
          assert.equal(new URL(request.url).hostname, 'returnxdigital.leadbyte.co.uk');
          affiliateCalls++;
          return Response.json({
            code: 1,
            response: 'Synthetic accepted',
            leadId: 'runtime-test-1',
          });
        },
      },
    ],
  }),
);
try {
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(resolve('migrations', file), 'utf8').replace(/--[^\n]*/g, '');
    await db.batch(
      sql
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => db.prepare(part)),
    );
  }
  const body = {
    lead_id: 'synthetic-runtime-1',
    form_id: 100,
    google_key: key,
    user_column_data: Object.entries({
      FIRST_NAME: 'Test',
      LAST_NAME: 'Testing',
      PHONE_NUMBER: '0821234567',
      ...Object.fromEntries(Object.keys(answers).map((field) => [field, 'Yes'])),
    }).map(([column_id, string_value]) => ({ column_id, string_value })),
  };
  const post = () =>
    mf.dispatchFetch('https://example.com/api/webhooks/google-ads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await post()).status, 200);
  let row;
  for (let i = 0; i < 100; i++) {
    row = await db.prepare('SELECT processing_status,leadbyte_lead_id FROM submissions').first();
    if (row?.processing_status === 'accepted') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(row?.processing_status, 'accepted');
  assert.equal(row?.leadbyte_lead_id, 'runtime-test-1');
  assert.equal((await post()).status, 200);
  assert.equal(affiliateCalls, 1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM submissions').first()).n, 1);
  const microsoftPost = () =>
    mf.dispatchFetch('https://example.com/api/webhooks/microsoft', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        source: 'microsoft_ads',
        externalLeadId: 'synthetic-microsoft-runtime-1',
        fullName: 'Test van der Example',
        email: 'test@example.com',
        phone: '0821234567',
        qualification: {
          age: '18_plus',
          vehicle: 'yes',
          employment: 'employed',
          income: '10000_plus',
        },
        contactConsent: true,
        marketingConsent: false,
        consentText: 'Synthetic contact permission',
        consentVersion: 'test-v1',
      }),
    });
  assert.equal((await microsoftPost()).status, 200);
  for (let i = 0; i < 100; i++) {
    row = await db
      .prepare(
        "SELECT processing_status,metadata_json FROM submissions WHERE source='MICROSOFT_ADS'",
      )
      .first();
    if (row?.processing_status === 'accepted') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(row?.processing_status, 'accepted');
  assert.equal(JSON.parse(row.metadata_json).fullName, 'Test van der Example');
  assert.equal((await microsoftPost()).status, 200);
  assert.equal(affiliateCalls, 2);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM submissions').first()).n, 2);
  console.log(
    'PASS: real workerd webhook → D1 → Queue → existing affiliate service → D1; duplicate suppressed. No external traffic.',
  );
} finally {
  await mf.dispose();
}
