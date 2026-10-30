import type { D1Database } from '@cloudflare/workers-types';

const vendorDetailKeys = new Set([
  'code',
  'description',
  'detail',
  'details',
  'error',
  'errors',
  'field',
  'message',
  'reason',
  'status',
  'validation',
  'validation_error',
  'validation_errors',
]);
type LeadReportRow = Record<string, unknown> & {
  leadbyte_response: string | null;
  leadbyte_details: string[];
};

function safeVendorText(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g, '[phone]')
    .slice(0, 300);
}

export function leadbyteDetails(infoJson: unknown): string[] {
  if (typeof infoJson !== 'string' || infoJson.length > 64000) return [];
  let info: unknown;
  try {
    info = JSON.parse(infoJson);
  } catch {
    return [];
  }

  const details: string[] = [];
  function collect(value: unknown, key = '', depth = 0) {
    if (depth > 4 || details.length >= 8) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (vendorDetailKeys.has(key.toLowerCase())) {
        const text = safeVendorText(String(value).trim());
        if (text) details.push(`${key.replaceAll('_', ' ')}: ${text}`);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 8)) collect(item, key, depth + 1);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [childKey, child] of Object.entries(value)) {
      if (vendorDetailKeys.has(childKey.toLowerCase())) collect(child, childKey, depth + 1);
    }
  }
  collect(info);
  return [...new Set(details)];
}

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
  const acquisitionSource = `CASE
    WHEN source <> 'WEBSITE' THEN source
    WHEN nullif(json_extract(metadata_json, '$.acquisitionSource'), '') IS NOT NULL
      THEN json_extract(metadata_json, '$.acquisitionSource')
    WHEN (json_extract(attribution_json, '$.msclkid') IS NOT NULL
        AND (json_extract(attribution_json, '$.utm_source') IS NULL
          OR lower(json_extract(attribution_json, '$.utm_source')) IN ('bing', 'microsoft', 'microsoft_ads')))
      OR (lower(coalesce(json_extract(attribution_json, '$.utm_source'), '')) IN ('bing', 'microsoft', 'microsoft_ads')
        AND lower(coalesce(json_extract(attribution_json, '$.utm_medium'), '')) IN ('cpc', 'ppc', 'paidsearch', 'paid_search'))
      THEN 'MICROSOFT_ADS'
    WHEN lower(coalesce(json_extract(attribution_json, '$.utm_source'), '')) = 'google'
      AND lower(coalesce(json_extract(attribution_json, '$.utm_medium'), '')) IN ('cpc', 'ppc', 'paidsearch', 'paid_search')
      THEN 'GOOGLE_ADS'
    WHEN nullif(trim(json_extract(attribution_json, '$.utm_source')), '') IS NOT NULL
      THEN json_extract(attribution_json, '$.utm_source')
    ELSE 'DIRECT_OR_UNTAGGED'
  END`;
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
        `SELECT acquisition_source AS source, COUNT(*) AS count FROM (SELECT ${acquisitionSource} AS acquisition_source FROM lead_reporting WHERE ${range}) GROUP BY acquisition_source ORDER BY count DESC`,
      )
      .bind(start, end),
    db
      .prepare(
        `SELECT source, COUNT(*) AS count FROM lead_reporting WHERE ${range} GROUP BY source ORDER BY count DESC`,
      )
      .bind(start, end),
    db
      .prepare(
        `SELECT request_id, submitted_at_utc, firstname, lastname, phone1, email, source, ${acquisitionSource} AS acquisition_source, processing_status, delivery_status, leadbyte_code, leadbyte_code_description, leadbyte_lead_id, leadbyte_response, leadbyte_info_json, diagnostic_code, json_extract(attribution_json, '$.utm_source') AS utm_source, json_extract(attribution_json, '$.utm_medium') AS utm_medium, utm_campaign, is_test FROM lead_reporting WHERE ${match} ORDER BY created_at DESC, request_id DESC${exportAll ? '' : ' LIMIT 50 OFFSET ?'}`,
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
  const leads: LeadReportRow[] = results[4].results.map((row): LeadReportRow => {
    const { leadbyte_info_json, ...lead } = row;
    return {
      ...lead,
      leadbyte_response:
        typeof lead.leadbyte_response === 'string' ? safeVendorText(lead.leadbyte_response) : null,
      leadbyte_details: leadbyteDetails(leadbyte_info_json),
    };
  });
  return {
    filters,
    statuses: results[0].results,
    daily: results[1].results,
    sources: results[2].results,
    ingestionSources: results[3].results,
    leads,
    total: results[5].results[0]?.count || 0,
    events: results[6].results,
    validationFailures: results[7].results,
    generatedAt: new Date().toISOString(),
  };
}
