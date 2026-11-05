import { expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { captureAttribution, sanitizeAttribution } from '../lib/attribution';
import { readReport, reportFilters } from '../lib/reporting';
import { createTestDatabase } from './d1Fixture';

it.each(['gclid', 'gbraid', 'wbraid'])(
  'preserves %s through navigation and clears it on a new campaign',
  (key) => {
    const captured = captureAttribution(`?${key}=Google_Click-123`);
    expect(captured).toEqual({ [key]: 'Google_Click-123' });
    expect(captureAttribution('', captured)).toEqual(captured);
    expect(sanitizeAttribution(captured)).toEqual(captured);
    expect(captureAttribution('?utm_source=bing&utm_medium=cpc', captured)).toEqual({
      utm_source: 'bing',
      utm_medium: 'cpc',
    });
    expect(captureAttribution('?gclid=new', captured)).toEqual({ gclid: 'new' });
  },
);

it.each(['{gclid}', 'x'.repeat(201), '<invalid>', 'contains spaces'])(
  'rejects malformed Google identifiers',
  (value) => {
    expect(sanitizeAttribution({ gclid: value, gbraid: value, wbraid: value })).toEqual({});
  },
);

it('classifies saved Google tags in dashboard totals and exported leads without relabelling organic or other channels', async () => {
  const db = createTestDatabase();
  const cases: [Record<string, string>, string][] = [
    [{ gclid: 'click' }, 'GOOGLE_ADS'],
    [{ gbraid: 'braid' }, 'GOOGLE_ADS'],
    [{ wbraid: 'braid' }, 'GOOGLE_ADS'],
    [{ utm_source: 'google', utm_medium: 'cpc' }, 'GOOGLE_ADS'],
    [{ utm_source: 'google_ads', utm_medium: 'ppc' }, 'GOOGLE_ADS'],
    [{ utm_source: 'google', utm_medium: 'organic' }, 'google'],
    [{ utm_source: 'newsletter', gclid: 'conflicting' }, 'newsletter'],
    [{ gclid: '' }, 'DIRECT_OR_UNTAGGED'],
    [{}, 'DIRECT_OR_UNTAGGED'],
  ];
  try {
    const insert = db.sqlite.prepare(`INSERT INTO submissions
      (submission_key,fingerprint,created_at,expires_at,consent_version,record_version,request_id,firstname,phone1,delivery_status,source,attribution_json)
      VALUES (?, 'fixture', ?, 0, 'test', 1, ?, 'Synthetic', '0820000000', 'accepted', 'WEBSITE', ?)`);
    cases.forEach(([attribution], i) =>
      insert.run(
        `google-${i}`,
        Date.parse('2026-10-01T12:00:00Z') + i,
        `google-${i}`,
        JSON.stringify(sanitizeAttribution(attribution)),
      ),
    );
    const report = await readReport(
      db as unknown as D1Database,
      reportFilters(new URL('https://example.com?from=2026-10-01&to=2026-10-01')),
      true,
    );
    expect(report.sources).toContainEqual({ source: 'GOOGLE_ADS', count: 5 });
    for (const [i, [, expected]] of cases.entries()) {
      expect(report.leads.find((lead) => lead.request_id === `google-${i}`)).toMatchObject({
        source: 'WEBSITE',
        acquisition_source: expected,
      });
    }
  } finally {
    db.sqlite.close();
  }
});
