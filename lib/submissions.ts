import type { LeadResult } from './leadbyte';
import { database } from './database';
import { CONSENT_VERSION } from './config';
import { buildPayload } from './leadbyte';
import type { LeadInput } from './validation';
import { sanitizeAttribution } from './attribution';
type Entry = { fingerprint: string; result: string | null; httpStatus: number | null };
export type LeadRecord = {
  requestId: string;
  input: LeadInput;
  site: string;
  submittedAt: Date;
  attribution: unknown;
};
// Lead records are retained for reporting. Pending deliveries stay claimed too.
export async function claimSubmission(key: string, fingerprint: string, lead?: LeadRecord) {
  const db = await database();
  const now = lead?.submittedAt.getTime() ?? Date.now();
  const payload = lead
    ? Object.fromEntries(buildPayload(lead.input, lead.site, lead.submittedAt))
    : null;
  const inserted = await db
    .prepare(
      `INSERT INTO submissions
      (submission_key, fingerprint, created_at, expires_at, consent_version,
       record_version, request_id, firstname, lastname, phone1, optinurl, optindate,
       acceptterms, offer_id, campaign_id, supplier_id, preferredtimeofcall,
       payload_json, qualification_json, attribution_json, delivery_status, email)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(submission_key) DO NOTHING
     RETURNING submission_key`,
    )
    .bind(
      key,
      fingerprint,
      now,
      CONSENT_VERSION,
      lead ? 1 : 0,
      lead?.requestId ?? null,
      payload?.firstname ?? null,
      payload?.lastname ?? null,
      payload?.phone1 ?? null,
      payload?.optinurl ?? null,
      payload?.optindate ?? null,
      payload?.acceptterms ?? null,
      payload?.offer_id ?? null,
      lead ? 'DASHCAMS' : null,
      lead ? '27144' : null,
      payload?.preferredtimeofcall ?? null,
      payload ? JSON.stringify(payload) : null,
      lead
        ? JSON.stringify({
            age: lead.input.age,
            vehicle: lead.input.vehicle,
            employment: lead.input.employment,
            income: lead.input.income,
          })
        : null,
      lead ? JSON.stringify(sanitizeAttribution(lead.attribution)) : null,
      lead ? 'pending' : 'legacy_unknown',
      lead?.input.email ?? null,
    )
    .first();
  if (inserted) return { claimed: true as const };
  const existing = await db
    .prepare(
      'SELECT fingerprint, result, http_status AS httpStatus FROM submissions WHERE submission_key = ?',
    )
    .bind(key)
    .first<Entry>();
  if (!existing) throw new Error('Submission record unavailable');
  return { claimed: false as const, existing };
}
export async function completeSubmission(
  key: string,
  result: Pick<LeadResult, 'state' | 'message'> & { retryable?: boolean },
  status: number,
  vendor?: LeadResult,
) {
  const db = await database();
  const updated = await db
    .prepare(
      `UPDATE submissions SET result = ?, http_status = ?, completed_at = ?,
       delivery_status = ?, leadbyte_code = ?, leadbyte_lead_id = ?, leadbyte_response = ?,
       leadbyte_info_json = ?, leadbyte_raw_response = ?, leadbyte_timestamp = ?,
       leadbyte_process_time = ?, upstream_http_status = ?, diagnostic_code = ?, delivery_uncertain = ?
     WHERE submission_key = ? AND result IS NULL RETURNING submission_key`,
    )
    .bind(
      JSON.stringify(result),
      status,
      Date.now(),
      vendor?.diagnosticCode === 'SUBMISSIONS_DISABLED'
        ? 'not_sent_disabled'
        : vendor?.uncertain
          ? 'uncertain'
          : vendor?.code === 1
            ? 'accepted'
            : vendor?.code === -2
              ? 'duplicate'
              : vendor?.code !== undefined
                ? 'rejected'
                : 'legacy_unknown',
      vendor?.code ?? null,
      vendor?.leadId ?? null,
      vendor?.response ?? null,
      vendor?.info !== undefined ? JSON.stringify(vendor.info) : null,
      vendor?.rawResponse ?? null,
      vendor?.timestamp ?? null,
      vendor?.processTime ?? null,
      vendor?.upstreamStatus ?? null,
      vendor?.diagnosticCode ?? null,
      vendor?.uncertain ? 1 : 0,
      key,
    )
    .first();
  if (!updated) throw new Error('Submission completion unavailable');
}
