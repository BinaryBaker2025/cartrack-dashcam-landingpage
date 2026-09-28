import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { microsoftLeadMapper } from './microsoftLeadMapper';
import { ingestLead } from './leadService';
import { InvalidWebhookPayload, readJsonBody, sanitizePayload } from './webhookPayload';
import { siteUrl } from './config';
import { log } from './logger';

export async function microsoftWebhook(request: Request, env: LeadBindings) {
  const id = randomUUID();
  const reply = (status: number, result?: Record<string, unknown>) =>
    Response.json(
      result || { message: status >= 500 ? 'Service unavailable' : 'Invalid request' },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': id } },
    );
  const reject = (status: number, diagnosticCode: string) => {
    log('WEBHOOK_REJECTED', { id, diagnosticCode });
    return reply(status);
  };
  const url = new URL(request.url);
  if (
    url.protocol !== 'https:' &&
    !(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.DEPLOY_ENV === 'development'
    )
  )
    return reject(403, 'HTTPS_REQUIRED');
  const secret = env.MICROSOFT_ADS_WEBHOOK_TOKEN;
  if (!secret || secret.length < 32) return reject(503, 'AUTHENTICATION_UNCONFIGURED');
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!token || !timingSafeEqual(hash(token), hash(secret)))
    return reject(401, 'AUTHENTICATION_FAILED');
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return reject(400, 'INVALID_CONTENT_TYPE');
  let raw: Record<string, unknown>;
  try {
    raw = await readJsonBody(request);
  } catch {
    return reject(400, 'INVALID_JSON');
  }
  try {
    const payload = JSON.stringify(sanitizePayload(raw, secret));
    await env.DB.prepare(
      `INSERT INTO webhook_events (id,provider,event_type,received_at,processing_status,payload_json)
      VALUES (?,'MICROSOFT_ADS','LEAD',?,'RECEIVED',?)`,
    )
      .bind(id, Date.now(), payload)
      .run();
    log('WEBHOOK_RECEIVED', { id });
    const result = await ingestLead(env, microsoftLeadMapper(raw), siteUrl(), { id, payload });
    return reply(200, {
      leadId: result.leadId,
      duplicate: result.duplicate,
      status: result.status,
    });
  } catch (error) {
    const invalid = error instanceof InvalidWebhookPayload;
    try {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED',error_message=?,processed_at=? WHERE id=? AND processing_status='RECEIVED'",
      )
        .bind(invalid ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED', Date.now(), id)
        .run();
    } catch {
      /* Database outage: return a retryable response without exposing details. */
    }
    return reject(invalid ? 400 : 503, invalid ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED');
  }
}
