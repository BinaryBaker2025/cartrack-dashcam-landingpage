import type { D1Database } from '@cloudflare/workers-types';

export function reportFilters(url: URL) {
  const today = new Date(Date.now() + 7200000).toISOString().slice(0, 10);
  const from =
    url.searchParams.get('from') ||
    new Date(Date.now() + 7200000 - 29 * 86400000).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || today;
  for (const date of [from, to]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new Error('INVALID_FILTER');
  }
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365)
    throw new Error('INVALID_FILTER');
  const page = Number(url.searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error('INVALID_FILTER');
  return {
    from,
    to,
    start: Date.parse(`${from}T00:00:00+02:00`),
    end: Date.parse(`${to}T00:00:00+02:00`) + 86400000,
    page,
    search: (url.searchParams.get('search') || '').trim().slice(0, 100),
  };
}

export async function readReport(
  db: D1Database,
  filters: ReturnType<typeof reportFilters>,
  exportAll = false,
) {
  const { from, to, start, end, page, search } = filters;
  const range = 'created_at >= ? AND created_at < ?';
  const match = `${range} AND (? = '' OR instr(lower(coalesce(firstname,'') || ' ' || coalesce(lastname,'') || ' ' || coalesce(phone1,'') || ' ' || coalesce(email,'') || ' ' || request_id), lower(?)) > 0)`;
  const results = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT delivery_status AS status, COUNT(*) AS count FROM lead_reporting WHERE ${range} GROUP BY delivery_status`,
      )
      .bind(start, end),
    db
      .prepare(
        'SELECT submitted_date_sa AS day, SUM(leads) AS count FROM lead_daily_summary WHERE submitted_date_sa >= ? AND submitted_date_sa <= ? GROUP BY submitted_date_sa ORDER BY day',
      )
      .bind(from, to),
    db
      .prepare(
        `SELECT source, COUNT(*) AS count FROM lead_reporting WHERE ${range} GROUP BY source ORDER BY count DESC`,
      )
      .bind(start, end),
    db
      .prepare(
        `SELECT request_id, submitted_at_utc, firstname, lastname, phone1, email, source, processing_status, delivery_status, leadbyte_code, leadbyte_code_description, leadbyte_lead_id, utm_source, utm_campaign, is_test FROM lead_reporting WHERE ${match} ORDER BY created_at DESC, request_id DESC${exportAll ? '' : ' LIMIT 50 OFFSET ?'}`,
      )
      .bind(start, end, search, search, ...(exportAll ? [] : [(page - 1) * 50])),
    db
      .prepare(`SELECT COUNT(*) AS count FROM lead_reporting WHERE ${match}`)
      .bind(start, end, search, search),
    db
      .prepare(
        'SELECT event, SUM(count) AS count FROM site_event_daily WHERE day >= ? AND day <= ? GROUP BY event',
      )
      .bind(from, to),
    db
      .prepare(
        'SELECT field, reason, SUM(count) AS count FROM site_validation_failure_daily WHERE day >= ? AND day <= ? GROUP BY field, reason ORDER BY count DESC, field, reason',
      )
      .bind(from, to),
  ]);
  return {
    filters,
    statuses: results[0].results,
    daily: results[1].results,
    sources: results[2].results,
    leads: results[3].results,
    total: results[4].results[0]?.count || 0,
    events: results[5].results,
    validationFailures: results[6].results,
    generatedAt: new Date().toISOString(),
  };
}
