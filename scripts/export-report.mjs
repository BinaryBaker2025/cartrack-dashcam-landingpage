import { existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const options = {};
// Positional arguments also work through npm.ps1, which can consume named flags.
if (args.length && !args[0].startsWith('--')) {
  if (args.length < 2 || args.length > 4 || (args[2] && !['summary', 'details'].includes(args[2])))
    throw new Error(
      'Usage: npm run report -- YYYY-MM-DD YYYY-MM-DD [summary|details] [artifacts/report.json]',
    );
  options.from = args[0];
  options.to = args[1];
  options.details = args[2] === 'details';
  options.out = args[3];
  args.length = 0;
}
for (let index = 0; index < args.length; index++) {
  const key = args[index];
  if (key === '--details') options.details = true;
  else if (['--from', '--to', '--out'].includes(key) && args[index + 1])
    options[key.slice(2)] = args[++index];
  else
    throw new Error(
      'Usage: npm run report -- --from YYYY-MM-DD --to YYYY-MM-DD [--details] [--out artifacts/report.json]',
    );
}
function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error('Both --from and --to must be valid YYYY-MM-DD dates (South African time).');
  return value;
}
const from = date(options.from);
const to = date(options.to);
if (from > to) throw new Error('--from must be on or before --to.');
const output = resolve(options.out || `artifacts/report-${from}-${to}-${Date.now()}.json`);
if (existsSync(output) || existsSync(output + '.tmp'))
  throw new Error('Output already exists; choose another --out path.');
function query(sql) {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      'D1 report query failed. Check wrangler login and the configured account/database.',
    );
  const data = JSON.parse(result.stdout);
  if (!Array.isArray(data) || data.some((row) => row.success !== true))
    throw new Error('D1 returned an unsuccessful query.');
  return data.flatMap((row) => row.results);
}
const start = Date.parse(`${from}T00:00:00+02:00`);
const end = Date.parse(`${to}T00:00:00+02:00`) + 86400000;
const summary = query(
  `SELECT * FROM lead_daily_summary WHERE submitted_date_sa >= '${from}' AND submitted_date_sa <= '${to}' ORDER BY submitted_date_sa, delivery_status, leadbyte_code`,
);
const report = {
  generatedAt: new Date().toISOString(),
  from,
  to,
  timezone: 'Africa/Johannesburg',
  summary,
};
if (options.details) {
  const leads = [];
  let cursor = -1;
  let cursorId = '';
  while (true) {
    // IDs come from server-generated UUIDs, not user input. Still quote defensively.
    const escapedId = cursorId.replaceAll("'", "''");
    const page =
      query(`SELECT request_id, created_at, completed_at, submitted_at_utc, submitted_date_sa,
      firstname, lastname, phone1, optinurl, optindate, acceptterms, consent_version,
      offer_id, campaign_id, supplier_id, preferredtimeofcall, qualification_json,
      attribution_json, affiliate_id, transaction_id, utm_source, utm_campaign, payload_json,
      delivery_status, leadbyte_code, leadbyte_code_description, leadbyte_lead_id,
      leadbyte_response, leadbyte_info_json, leadbyte_raw_response, leadbyte_timestamp,
      leadbyte_process_time, upstream_http_status, http_status, diagnostic_code, delivery_uncertain
      FROM lead_reporting WHERE created_at >= ${start} AND created_at < ${end}
      AND (created_at > ${cursor} OR (created_at = ${cursor} AND request_id > '${escapedId}'))
      ORDER BY created_at, request_id LIMIT 250`);
    leads.push(...page);
    if (page.length < 250) break;
    cursor = page.at(-1).created_at;
    cursorId = page.at(-1).request_id;
  }
  report.leads = leads;
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output + '.tmp', JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
renameSync(output + '.tmp', output);
console.log(
  `Saved ${summary.length} summary groups${report.leads ? ` and ${report.leads.length} lead records` : ''} to ${output}`,
);
