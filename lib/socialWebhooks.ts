import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { parseWebhookJson, readRawBody, InvalidWebhookPayload } from './webhookPayload';

export type SocialProvider = 'META_ADS' | 'TIKTOK_ADS';
export function socialReply(status: number) {
  return Response.json(
    { received: status === 200 },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function metaChallenge(request: Request, env: LeadBindings) {
  if (!env.META_VERIFY_TOKEN || env.META_VERIFY_TOKEN.length < 32) return socialReply(503);
  const params = new URL(request.url).searchParams;
  const challenge = params.get('hub.challenge');
  if (
    params.get('hub.mode') !== 'subscribe' ||
    !challenge ||
    challenge.length > 1024 ||
    !equal(params.get('hub.verify_token') || '', env.META_VERIFY_TOKEN)
  )
    return socialReply(403);
  return new Response(challenge, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
export function verifySocialSignature(
  provider: SocialProvider,
  body: Buffer,
  header: string,
  secret: string,
  now = Date.now(),
) {
  if (provider === 'META_ADS') {
    if (!/^sha256=[a-fA-F0-9]{64}$/.test(header)) return false;
    return equal(
      header.slice(7).toLowerCase(),
      createHmac('sha256', secret).update(body).digest('hex'),
    );
  }
  const parts = header.split(',').map((part) => part.trim());
  const times = parts.filter((part) => /^t=\d+$/.test(part));
  const signatures = parts.filter((part) => /^s=[a-fA-F0-9]{64}$/.test(part));
  if (times.length !== 1 || signatures.length !== 1 || parts.length !== 2) return false;
  const timestamp = times[0].slice(2);
  if (!Number.isSafeInteger(Number(timestamp)) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return equal(signatures[0].slice(2).toLowerCase(), expected);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InvalidWebhookPayload('INVALID_OBJECT');
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,80}$/.test(value))
    throw new InvalidWebhookPayload('INVALID_ID');
  return value;
}
export function socialEntries(
  raw: Record<string, unknown>,
  provider: SocialProvider,
  env: LeadBindings,
) {
  if (raw.object !== (provider === 'META_ADS' ? 'page' : 1))
    throw new InvalidWebhookPayload('INVALID_EVENT');
  if (!Array.isArray(raw.entry) || !raw.entry.length || raw.entry.length > 100)
    throw new InvalidWebhookPayload('INVALID_ENTRIES');
  for (const value of raw.entry) {
    const entry = object(value);
    if (provider === 'META_ADS') {
      if (identifier(entry.id) !== env.META_PAGE_ID)
        throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      if (!Array.isArray(entry.changes) || entry.changes.length > 100)
        throw new InvalidWebhookPayload('INVALID_CHANGES');
      for (const value of entry.changes) {
        const change = object(value);
        if (change.field !== 'leadgen') continue;
        const lead = object(change.value);
        identifier(lead.leadgen_id);
        identifier(lead.form_id);
        if (lead.page_id !== undefined && identifier(lead.page_id) !== env.META_PAGE_ID)
          throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      }
    } else {
      if (identifier(entry.advertiser_id) !== env.TIKTOK_ADVERTISER_ID)
        throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      identifier(entry.id);
      identifier(entry.page_id);
      if (entry.lead_source !== undefined && entry.lead_source !== 'INSTANT_FORM')
        throw new InvalidWebhookPayload('UNSUPPORTED_LEAD_SOURCE');
      if (!Array.isArray(entry.changes) || entry.changes.length > 100)
        throw new InvalidWebhookPayload('INVALID_CHANGES');
    }
  }
  return raw.entry.map(object);
}
export async function receiveSocialWebhook(
  request: Request,
  env: LeadBindings,
  provider: SocialProvider,
) {
  const secret = provider === 'META_ADS' ? env.META_APP_SECRET : env.TIKTOK_APP_SECRET;
  const account = provider === 'META_ADS' ? env.META_PAGE_ID : env.TIKTOK_ADVERTISER_ID;
  if (!secret || !account) return socialReply(503);
  if (new URL(request.url).protocol !== 'https:' && process.env.DEPLOY_ENV !== 'development')
    return socialReply(403);
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return socialReply(400);
  let body: Buffer;
  try {
    body = await readRawBody(request);
  } catch {
    return socialReply(400);
  }
  if (
    !verifySocialSignature(
      provider,
      body,
      request.headers.get(provider === 'META_ADS' ? 'x-hub-signature-256' : 'tiktok-signature') ||
        '',
      secret,
    )
  )
    return socialReply(403);
  try {
    socialEntries(parseWebhookJson(body.toString('utf8')), provider, env);
  } catch {
    return socialReply(400);
  }
  // Raw body is stored after authentication only; never log PII or credentials.
  const id = createHash('sha256').update(provider).update(body).digest('hex');
  try {
    await env.DB.prepare(
      'INSERT INTO social_webhook_inbox(id,provider,payload_json,received_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
    )
      .bind(id, provider, body.toString('utf8'), Date.now())
      .run();
    return socialReply(200);
  } catch {
    return socialReply(503);
  }
}
