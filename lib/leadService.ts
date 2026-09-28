import { createHash, randomUUID } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import { buildPayload } from './leadbyte';
import { assessLead, type LeadRequest } from './leadModel';
import { digest, log } from './logger';
import { sanitizeAttribution } from './attribution';
import type { LeadBindings } from './leadBindings';

export class LeadConflict extends Error {}
export type WebhookReceipt = { id: string; payload: string };
export async function ingestLead(
  env: LeadBindings,
  lead: LeadRequest,
  site: string,
  event?: WebhookReceipt,
) {
  const assessed = assessLead(lead);
  const key =
    lead.source === 'WEBSITE'
      ? digest(`submission:${lead.externalLeadId}`)
      : createHash('sha256').update(`${lead.source}:${lead.externalLeadId}`).digest('hex');
  const fingerprint = digest(JSON.stringify(assessed.input));
  const now = Date.parse(lead.receivedAt);
  const status =
    assessed.status === 'pending' && process.env.LEADBYTE_ENABLED !== 'true'
      ? 'not_sent_disabled'
      : assessed.status;
  const payload = assessed.valid
    ? Object.fromEntries(
        buildPayload(assessed.input, site, new Date(lead.submittedAt || lead.receivedAt)),
      )
    : null;
  const row = {
    submission_key: key,
    fingerprint,
    created_at: now,
    expires_at: 0,
    consent_version: lead.consentVersion || '',
    record_version: 1,
    request_id: randomUUID(),
    firstname: assessed.input.firstname || lead.firstname?.trim() || null,
    lastname: assessed.input.lastname || lead.lastname?.trim() || null,
    phone1: assessed.input.phone || null,
    original_phone: lead.phone || null,
    email: assessed.input.email || null,
    optinurl: payload?.optinurl || null,
    optindate: payload?.optindate || null,
    acceptterms:
      lead.contactConsent === true ? 'true' : lead.contactConsent === false ? 'false' : null,
    offer_id: '3046',
    campaign_id: 'DASHCAMS',
    supplier_id: '27144',
    preferredtimeofcall: payload?.preferredtimeofcall || null,
    payload_json: payload ? JSON.stringify(payload) : null,
    qualification_json: JSON.stringify(lead.qualification || {}),
    attribution_json: JSON.stringify(sanitizeAttribution(lead.attribution)),
    delivery_status: status,
    processing_status: status,
    source: lead.source,
    external_lead_id: lead.externalLeadId,
    source_campaign_id: lead.campaignId || null,
    campaign_name: lead.campaignName || null,
    ad_group_id: lead.adGroupId || null,
    ad_id: lead.adId || null,
    form_id: lead.formId || null,
    marketing_consent:
      typeof lead.marketingConsent === 'boolean' ? Number(lead.marketingConsent) : null,
    consent_text: lead.consentText || null,
    consent_timestamp: lead.consentTimestamp || null,
    consent_source: lead.consentSource || lead.source,
    submitted_at: lead.submittedAt || null,
    metadata_json: JSON.stringify(lead.metadata || {}),
    updated_at: now,
    is_test: Number(!!lead.isTest),
    diagnostic_code: assessed.valid ? null : 'QUALIFICATION_OR_CONSENT_REQUIRED',
  };
  // Column names are application constants, values are always bound parameters.
  const statements = [
    env.DB.prepare(
      `INSERT INTO submissions (${Object.keys(row).join(',')})
    VALUES (${Object.keys(row)
      .map(() => '?')
      .join(',')}) ON CONFLICT DO NOTHING`,
    ).bind(...Object.values(row)),
    env.DB.prepare(
      `INSERT INTO lead_outbox (lead_id, created_at)
      SELECT submission_key, created_at FROM submissions WHERE submission_key = ? AND processing_status = 'pending'
      ON CONFLICT DO NOTHING`,
    ).bind(key),
  ];
  if (event)
    statements.push(
      env.DB.prepare(
        `UPDATE webhook_events SET lead_id = ?, external_lead_id = ?,
    processing_status = CASE WHEN (SELECT request_id FROM submissions WHERE submission_key = ?) = ?
      THEN 'RECEIVED' ELSE 'DUPLICATE' END WHERE id = ?`,
      ).bind(key, lead.externalLeadId, key, row.request_id, event.id),
    );
  await env.DB.batch(statements);
  const stored = await env.DB.prepare(
    'SELECT request_id, fingerprint, processing_status, result, http_status FROM submissions WHERE submission_key = ?',
  )
    .bind(key)
    .first<{
      request_id: string;
      fingerprint: string;
      processing_status: string;
      result: string | null;
      http_status: number | null;
    }>();
  if (!stored) throw new Error('LEAD_NOT_STORED');
  if (lead.source === 'WEBSITE' && stored.fingerprint !== fingerprint)
    throw new LeadConflict('SUBMISSION_CONFLICT');
  const duplicate = stored.request_id !== row.request_id;
  log(duplicate ? 'LEAD_DUPLICATE' : 'LEAD_CREATED', { id: key });
  // A durable outbox is committed already. A failed publish is recovered by cron.
  try {
    await publishLead(env, key);
  } catch {
    log('LEAD_QUEUE_DEFERRED', { id: key, diagnosticCode: 'OUTBOX_RECOVERY_PENDING' });
  }
  if (event && !duplicate) {
    await env.DB.prepare(
      `UPDATE webhook_events SET processing_status = ?, error_message = ?
      WHERE id = ? AND processing_status = 'RECEIVED'`,
    )
      .bind(
        ['pending_review', 'rejected', 'test', 'not_sent_disabled'].includes(status)
          ? status.toUpperCase()
          : 'RECEIVED',
        assessed.valid ? null : 'QUALIFICATION_OR_CONSENT_REQUIRED',
        event.id,
      )
      .run();
  }
  return {
    leadId: key,
    duplicate,
    status: stored.processing_status,
    legacyResult: stored.processing_status === 'legacy' ? stored : undefined,
  };
}

export async function publishLead(env: LeadBindings, leadId: string) {
  const pending = await env.DB.prepare(
    `SELECT o.lead_id FROM lead_outbox o JOIN submissions s ON s.submission_key=o.lead_id
    WHERE o.lead_id=? AND o.published_at IS NULL AND s.processing_status IN ('pending','queued')`,
  )
    .bind(leadId)
    .first();
  if (!pending) return;
  await env.DB.prepare('UPDATE lead_outbox SET publish_attempts=publish_attempts+1 WHERE lead_id=?')
    .bind(leadId)
    .run();
  await env.LEAD_QUEUE.send({ leadId });
  await env.DB.batch([
    env.DB.prepare('UPDATE lead_outbox SET published_at=? WHERE lead_id=?').bind(
      Date.now(),
      leadId,
    ),
    env.DB.prepare(
      "UPDATE submissions SET processing_status='queued', updated_at=? WHERE submission_key=? AND processing_status='pending'",
    ).bind(Date.now(), leadId),
    env.DB.prepare(
      "UPDATE webhook_events SET processing_status='QUEUED' WHERE lead_id=? AND processing_status='RECEIVED'",
    ).bind(leadId),
  ]);
  log('LEAD_QUEUED', { id: leadId });
}

export async function recoverOutbox(env: LeadBindings) {
  const { results } = await env.DB.prepare(
    `SELECT o.lead_id FROM lead_outbox o JOIN submissions s ON s.submission_key=o.lead_id
    WHERE o.published_at IS NULL AND s.processing_status IN ('pending','queued') ORDER BY o.created_at LIMIT 100`,
  ).all<{ lead_id: string }>();
  for (const row of results) {
    try {
      await publishLead(env, row.lead_id);
    } catch {
      log('LEAD_QUEUE_DEFERRED', { id: row.lead_id, diagnosticCode: 'OUTBOX_RECOVERY_PENDING' });
    }
  }
  await markStaleAttempts(env.DB);
}

export async function markStaleAttempts(db: D1Database) {
  await db.batch([
    db
      .prepare(
        `UPDATE lead_attempts SET outcome='uncertain', completed_at=? WHERE outcome='started'
      AND lead_id IN (SELECT submission_key FROM submissions WHERE processing_status='processing' AND lease_until < ?)`,
      )
      .bind(Date.now(), Date.now()),
    db
      .prepare(
        `UPDATE webhook_events SET processing_status='FAILED', error_message='DELIVERY_UNCERTAIN', processed_at=?
      WHERE processing_status NOT IN ('DUPLICATE','PROCESSED') AND lead_id IN
      (SELECT submission_key FROM submissions WHERE processing_status='processing' AND lease_until < ?)`,
      )
      .bind(Date.now(), Date.now()),
    db
      .prepare(
        `UPDATE submissions SET processing_status='uncertain', delivery_status='uncertain', delivery_uncertain=1,
      diagnostic_code='DELIVERY_UNCERTAIN', updated_at=? WHERE processing_status='processing' AND lease_until < ?`,
      )
      .bind(Date.now(), Date.now()),
  ]);
}
