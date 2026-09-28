import { readJsonBody, sanitizePayload } from './webhookPayload';
export { readJsonBody } from './webhookPayload';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { googleLeadMapper, InvalidGooglePayload, type GoogleMappings } from './googleLeadMapper';
import { ingestLead } from './leadService';
import type { LeadBindings } from './leadBindings';
import { siteUrl } from './config';
import { log } from './logger';

export async function googleWebhook(request: Request, env: LeadBindings) {
  const id = randomUUID();
  const reply = (status: number) =>
    Response.json(
      status === 200 ? {} : { message: status >= 500 ? 'Service unavailable' : 'Invalid request' },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': id } },
    );
  const url = new URL(request.url);
  if (
    url.protocol !== 'https:' &&
    !(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.DEPLOY_ENV === 'development'
    )
  )
    return reply(403);
  if (!env.GOOGLE_ADS_WEBHOOK_KEY || env.GOOGLE_ADS_WEBHOOK_KEY.length < 32) return reply(503);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply(400);
  let raw: Record<string, unknown>;
  try {
    raw = await readJsonBody(request);
  } catch {
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'INVALID_JSON' });
    return reply(400);
  }
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (
    typeof raw.google_key !== 'string' ||
    !timingSafeEqual(hash(raw.google_key), hash(env.GOOGLE_ADS_WEBHOOK_KEY))
  ) {
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'AUTHENTICATION_FAILED' });
    return reply(403);
  }
  try {
    const payload = JSON.stringify(sanitizePayload(raw, env.GOOGLE_ADS_WEBHOOK_KEY));
    await env.DB.prepare(
      `INSERT INTO webhook_events (id,provider,event_type,received_at,processing_status,payload_json)
      VALUES (?,'GOOGLE_ADS','LEAD',?,'RECEIVED',?)`,
    )
      .bind(id, Date.now(), payload)
      .run();
    log('WEBHOOK_RECEIVED', { id });
    let mappings: GoogleMappings;
    try {
      mappings = JSON.parse(env.GOOGLE_ADS_FORM_MAPPINGS || '{}');
      if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) throw new Error();
    } catch {
      throw new Error('MAPPING_CONFIGURATION_INVALID');
    }
    try {
      const lead = googleLeadMapper(raw, mappings);
      await ingestLead(env, lead, siteUrl(), { id, payload });
    } catch (error) {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED', error_message=?, processed_at=? WHERE id=?",
      )
        .bind(
          error instanceof InvalidGooglePayload ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED',
          Date.now(),
          id,
        )
        .run();
      if (error instanceof InvalidGooglePayload) return reply(400);
      throw error;
    }
    return reply(200);
  } catch {
    try {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED',error_message='INGESTION_FAILED',processed_at=? WHERE id=? AND processing_status='RECEIVED'",
      )
        .bind(Date.now(), id)
        .run();
    } catch {
      /* A database outage must not leak details into the response. */
    }
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'INGESTION_FAILED' });
    return reply(503);
  }
}
