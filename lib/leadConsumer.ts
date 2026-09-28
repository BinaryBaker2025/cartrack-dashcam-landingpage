import { randomUUID } from 'node:crypto';
import type { MessageBatch } from '@cloudflare/workers-types';
import type { LeadBindings, LeadJob } from './leadBindings';
import { submitLead, type LeadResult } from './leadbyte';
import { log } from './logger';
import { markStaleAttempts } from './leadService';
import type { LeadInput } from './validation';

type StoredLead = {
  submission_key: string;
  firstname: string;
  lastname: string;
  phone1: string;
  email?: string;
  qualification_json: string;
  preferredtimeofcall: string | null;
  created_at: number;
  submitted_at: string | null;
  processing_status: string;
  retry_count: number;
  lease_until: number | null;
  acceptterms: string | null;
  is_test: number;
};
const terminal = new Set([
  'accepted',
  'duplicate',
  'rejected',
  'pending_review',
  'test',
  'uncertain',
  'not_sent_disabled',
  'legacy',
  'dead_letter',
]);
export async function consumeLeads(
  batch: MessageBatch<LeadJob>,
  env: LeadBindings,
  send = submitLead,
) {
  for (const message of batch.messages) {
    const leadId =
      message.body &&
      typeof message.body.leadId === 'string' &&
      /^[a-f0-9]{64}$/.test(message.body.leadId)
        ? message.body.leadId
        : null;
    try {
      if (batch.queue === 'bestcardash-leads-dlq') {
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO lead_dead_letters(message_id,lead_id,received_at,reason) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
          ).bind(
            message.id,
            leadId,
            Date.now(),
            leadId ? 'RETRIES_EXHAUSTED' : 'INVALID_QUEUE_MESSAGE',
          ),
          env.DB.prepare(
            `UPDATE submissions SET processing_status='dead_letter', delivery_status='failed', updated_at=?,
            diagnostic_code='RETRIES_EXHAUSTED' WHERE submission_key=? AND processing_status IN ('pending','queued','retry','failed')`,
          ).bind(Date.now(), leadId),
          env.DB.prepare(
            `UPDATE webhook_events SET processing_status='FAILED', error_message='RETRIES_EXHAUSTED', processed_at=?
            WHERE lead_id=? AND processing_status NOT IN ('DUPLICATE','PROCESSED')
            AND EXISTS (SELECT 1 FROM submissions WHERE submission_key=lead_id AND processing_status='dead_letter')`,
          ).bind(Date.now(), leadId),
        ]);
        log('AFFILIATE_SUBMISSION_FAILED', {
          id: leadId || message.id,
          diagnosticCode: 'DEAD_LETTER_RECORDED',
        });
        message.ack();
        continue;
      }
      if (!leadId) {
        message.retry();
        continue;
      }
      let row = await env.DB.prepare('SELECT * FROM submissions WHERE submission_key=?')
        .bind(leadId)
        .first<StoredLead>();
      if (!row) {
        message.retry();
        continue;
      }
      if (row.processing_status === 'processing' && (row.lease_until || 0) < Date.now()) {
        await markStaleAttempts(env.DB);
        message.ack();
        continue;
      }
      if (terminal.has(row.processing_status)) {
        message.ack();
        continue;
      }
      if (row.processing_status === 'processing') {
        message.retry({ delaySeconds: 120 });
        continue;
      }
      if (row.retry_count >= 6 || row.processing_status === 'failed') {
        message.retry();
        continue;
      }
      if (process.env.LEADBYTE_ENABLED !== 'true') {
        message.retry({ delaySeconds: 300 });
        continue;
      }
      // Defence in depth: test/non-consenting records must never reach the affiliate.
      if (row.is_test || row.acceptterms !== 'true') {
        message.ack();
        continue;
      }
      const attemptId = randomUUID();
      row = await env.DB.prepare(
        `UPDATE submissions SET processing_status='processing', attempt_id=?, lease_until=?,
        retry_count=retry_count+1, updated_at=? WHERE submission_key=? AND processing_status IN ('pending','queued','retry')
        AND retry_count < 6 RETURNING *`,
      )
        .bind(attemptId, Date.now() + 120000, Date.now(), leadId)
        .first<StoredLead>();
      if (!row) {
        message.retry({ delaySeconds: 120 });
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO lead_attempts(id,lead_id,started_at,outcome) VALUES (?,?,?,'started')",
      )
        .bind(attemptId, leadId, Date.now())
        .run();
      const call = row.preferredtimeofcall?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
      const input: LeadInput = {
        ...JSON.parse(row.qualification_json),
        firstname: row.firstname,
        lastname: row.lastname,
        phone: row.phone1,
        ...(row.email ? { email: row.email } : {}),
        terms: true,
        website: '',
        preferredtimeofcall: call ? `${call[3]}-${call[2]}-${call[1]}T${call[4]}` : '',
      };
      log('AFFILIATE_SUBMISSION_STARTED', { id: leadId });
      let result: LeadResult;
      try {
        result = await send(input, new Date(row.submitted_at || row.created_at));
      } catch {
        // Unknown exceptions may occur after a send: never blindly take over a claimed attempt.
        result = {
          state: 'temporary_error',
          message: 'Delivery requires review',
          uncertain: true,
          diagnosticCode: 'DELIVERY_UNCERTAIN',
        };
      }
      // Network/timeouts are retried as requested. Without vendor idempotency, a lost
      // response can still mean upstream acceptance; see LEAD-PIPELINE.md.
      const retry =
        result.state === 'temporary_error' &&
        (!result.uncertain ||
          ['LEADBYTE_TIMEOUT', 'LEADBYTE_NETWORK_ERROR'].includes(result.diagnosticCode || ''));
      const outcome =
        result.state === 'success'
          ? 'accepted'
          : result.state === 'duplicate'
            ? 'duplicate'
            : retry
              ? row.retry_count >= 6
                ? 'failed'
                : 'retry'
              : result.uncertain
                ? 'uncertain'
                : 'rejected';
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE submissions SET processing_status=?, delivery_status=?, updated_at=?, completed_at=?, lease_until=NULL,
          leadbyte_code=?, leadbyte_lead_id=?, leadbyte_response=?, leadbyte_info_json=?, leadbyte_raw_response=?,
          leadbyte_timestamp=?, leadbyte_process_time=?, upstream_http_status=?, diagnostic_code=?, delivery_uncertain=?
          WHERE submission_key=? AND attempt_id=? AND processing_status IN ('processing','uncertain')`,
        ).bind(
          outcome,
          outcome === 'retry' ? 'pending' : outcome,
          Date.now(),
          retry ? null : Date.now(),
          result.code ?? null,
          result.leadId ?? null,
          result.response ?? null,
          result.info === undefined ? null : JSON.stringify(result.info),
          result.rawResponse ?? null,
          result.timestamp ?? null,
          result.processTime ?? null,
          result.upstreamStatus ?? null,
          result.diagnosticCode ?? null,
          Number(!!result.uncertain),
          leadId,
          attemptId,
        ),
        env.DB.prepare(
          'UPDATE lead_attempts SET completed_at=?,outcome=?,result_json=? WHERE id=?',
        ).bind(Date.now(), outcome, JSON.stringify(result), attemptId),
        env.DB.prepare(
          `UPDATE webhook_events SET processing_status=?, processed_at=?, error_message=?
          WHERE lead_id=? AND processing_status <> 'DUPLICATE'`,
        ).bind(
          retry ? 'QUEUED' : ['accepted', 'duplicate'].includes(outcome) ? 'PROCESSED' : 'FAILED',
          retry ? null : Date.now(),
          result.diagnosticCode || (outcome === 'rejected' ? 'AFFILIATE_REJECTED' : null),
          leadId,
        ),
      ]);
      log(
        retry
          ? 'AFFILIATE_SUBMISSION_RETRY'
          : outcome === 'accepted'
            ? 'AFFILIATE_SUBMISSION_SUCCESS'
            : outcome === 'uncertain'
              ? 'AFFILIATE_SUBMISSION_FAILED'
              : 'AFFILIATE_SUBMISSION_REJECTED',
        { id: leadId, code: result.code },
      );
      if (retry) message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** (row.retry_count - 1)) });
      else message.ack();
    } catch {
      log('AFFILIATE_SUBMISSION_RETRY', {
        id: leadId || message.id,
        diagnosticCode: 'PROCESSING_OR_STORAGE_FAILED',
      });
      message.retry({ delaySeconds: 120 });
    }
  }
}
