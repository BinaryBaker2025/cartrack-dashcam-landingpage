import { expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createTestDatabase } from './d1Fixture';
import { reportAccess } from '../lib/reportAuth';
import { privateReportResponse } from '../lib/reportResponse';
import { readReport, reportFilters } from '../lib/reporting';
import { reportSheets } from '../lib/reportWorkbook';
import writeExcelFile from 'write-excel-file/universal';
import { unzipSync, strFromU8 } from 'fflate';

it('preserves streamed report content, status and headers instead of stringifying the Response', async () => {
  const upstream = new Response('<html><body>Owner dashboard</body></html>', {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
  const response = privateReportResponse(upstream);
  expect(await response.text()).toBe('<html><body>Owner dashboard</body></html>');
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  const redirect = privateReportResponse(Response.redirect('https://example.com/reports', 307));
  expect(redirect.status).toBe(307);
  expect(redirect.headers.get('Location')).toBe('https://example.com/reports');
  const failure = privateReportResponse(Response.json({ error: 'Unavailable' }, { status: 503 }));
  expect(failure.status).toBe(503);
  expect(await failure.json()).toEqual({ error: 'Unavailable' });
});

it('fails closed and only accepts the owner credentials', () => {
  const password = 'a-long-test-password-for-owner';
  const request = (value: string) =>
    new Request('https://reports.example.com', {
      headers: { Authorization: `Basic ${btoa(value)}` },
    });
  expect(reportAccess(request('owner:wrong'), password)?.status).toBe(401);
  expect(reportAccess(request(`other:${password}`), password)?.status).toBe(401);
  expect(reportAccess(request(`owner:${password}`), '')?.status).toBe(503);
  expect(reportAccess(request(`owner:${password}`), password)).toBeNull();
});

it('validates dates and pagination and uses inclusive South African days', () => {
  const filters = reportFilters(new URL('https://example.com?from=2026-10-01&to=2026-10-01'));
  expect(filters.start).toBe(Date.parse('2026-09-30T22:00:00Z'));
  expect(filters.end).toBe(Date.parse('2026-10-01T22:00:00Z'));
  for (const query of [
    'from=2026-02-30',
    'page=NaN',
    'page=-1',
    'from=2026-10-02&to=2026-10-01',
    'from=2020-01-01&to=2026-01-01',
  ]) {
    expect(() => reportFilters(new URL(`https://example.com?${query}`))).toThrow();
  }
});

it('executes the dashboard queries against the migrated SQL views', async () => {
  const db = createTestDatabase();
  try {
    const insert = db.sqlite.prepare(`INSERT INTO submissions
      (submission_key,fingerprint,created_at,expires_at,consent_version,record_version,request_id,firstname,phone1,delivery_status,source)
      VALUES (?, 'fixture', ?, 0, 'test', 1, ?, 'Synthetic', '0820000000', 'accepted', 'WEBSITE')`);
    const start = Date.parse('2026-09-30T22:00:00Z');
    for (let i = 0; i < 51; i++) insert.run(`lead-${i}`, start + i, `request-${i}`);
    insert.run('excluded', Date.parse('2026-10-02T22:00:00Z'), 'excluded');
    db.sqlite
      .prepare('INSERT INTO site_event_daily(day,event,count) VALUES (?,?,?)')
      .run('2026-10-01', 'landing_page_view', 7);
    const filters = reportFilters(
      new URL('https://example.com?from=2026-10-01&to=2026-10-02&search=%27%20OR%201%3D1'),
    );
    const report = await readReport(db as unknown as D1Database, filters);
    expect(report.total).toBe(0);
    expect(report.leads).toEqual([]);
    expect(report.events).toEqual([{ event: 'landing_page_view', count: 7 }]);
    const first = await readReport(db as unknown as D1Database, { ...filters, search: '' });
    expect(first.total).toBe(51);
    expect(first.leads).toHaveLength(50);
    expect(first.statuses).toEqual([{ status: 'accepted', count: 51 }]);
    expect(first.daily).toEqual([{ day: '2026-10-01', count: 51 }]);
    const second = await readReport(db as unknown as D1Database, {
      ...filters,
      search: '',
      page: 2,
    });
    expect(second.leads).toHaveLength(1);
    expect(second.leads[0].request_id).toBe('request-0');
    const exported = await readReport(
      db as unknown as D1Database,
      { ...filters, search: '', page: 2 },
      true,
    );
    expect(exported.leads).toHaveLength(51);
    exported.leads[0].firstname = '=HYPERLINK("https://example.com")';
    const workbook = await writeExcelFile(reportSheets(exported)).toBlob();
    const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()));
    const workbookXml = strFromU8(files['xl/workbook.xml']);
    expect(workbookXml).toContain('Overview');
    expect(workbookXml).toContain('Leads');
    expect(workbookXml).toContain('Daily leads');
    const xml = Object.entries(files)
      .filter(([name]) => name.endsWith('.xml'))
      .map(([, data]) => strFromU8(data))
      .join('');
    expect(xml).toContain('0820000000');
    expect(xml).toContain('=HYPERLINK(');
    expect(xml).not.toContain('<f>');
    expect(xml).toContain('request-0');
    const searched = await readReport(
      db as unknown as D1Database,
      { ...filters, search: 'request-50' },
      true,
    );
    expect(searched.leads).toHaveLength(1);
  } finally {
    db.sqlite.close();
  }
});
