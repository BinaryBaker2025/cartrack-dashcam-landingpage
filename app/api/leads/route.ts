import { randomUUID } from 'node:crypto';
import { validateLead } from '@/lib/validation';
import { rateLimit } from '@/lib/rateLimit';
import { ingestLead, LeadConflict } from '@/lib/leadService';
import { leadBindings } from '@/lib/leadBindings';
import { submissionConfig, CONSENT_VERSION } from '@/lib/config';
import { digest, log } from '@/lib/logger';
import { ConfigurationError } from '@/lib/diagnostics';
import { checkDatabase } from '@/lib/database';
import { microsoftWebsiteDetails } from '@/lib/microsoftAds';
export const runtime = 'nodejs';
export const maxDuration = 30;
function jsonResponse(body: unknown, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
const failure = {
  state: 'temporary_error',
  message: "We couldn't submit your request right now. Please try again shortly.",
};
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function POST(request: Request) {
  const requestId = randomUUID();
  function json(body: Record<string, unknown>, status = 200, headers = {}) {
    const defaults: Record<number, string> = {
      400: 'REQUEST_INVALID',
      403: 'ORIGIN_MISMATCH',
      415: 'CONTENT_TYPE_INVALID',
      422: 'VALIDATION_FAILED',
      429: 'RATE_LIMITED',
      409: 'SUBMISSION_CONFLICT',
      503: 'SUBMISSIONS_DISABLED',
    };
    const diagnostics = body.diagnostics || { code: defaults[status] || 'REQUEST_OK', requestId };
    if (status >= 400)
      log('lead_response_error', {
        id: requestId,
        diagnosticCode: (diagnostics as { code: string }).code,
      });
    return jsonResponse({ ...body, diagnostics }, status, {
      'X-Request-ID': requestId,
      ...headers,
    });
  }
  try {
    const { site, allowedOriginsList } = submissionConfig();
    const origin = request.headers.get('origin');
    if (
      !origin ||
      !allowedOriginsList.includes(origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json(
        { state: 'api_rejected', message: 'Please submit your request from our website.' },
        403,
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return json({ state: 'api_rejected', message: 'Please submit using the quote form.' }, 415);
    const limit = await rateLimit(request);
    if (!limit.allowed)
      return json(
        {
          state: 'temporary_error',
          message: 'You’ve made several requests. Please wait a few minutes before trying again.',
        },
        429,
        { 'Retry-After': String(limit.retryAfter) },
      );
    let raw: Record<string, unknown>;
    try {
      raw = await readBody(request);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid body');
    } catch {
      return json(
        { state: 'api_rejected', message: 'Please check your information and try again.' },
        400,
      );
    }
    if (raw.website)
      return json(
        {
          state: 'api_rejected',
          message: 'We’re unable to process this request.',
          diagnostics: { code: 'HONEYPOT_FILLED', requestId },
        },
        400,
      );
    const now = new Date();
    const validation = validateLead(raw, now, { requireEmail: true });
    const { input, reasons, errors } = validation;
    if (!validation.valid) {
      if (reasons.length) {
        log('qualification_failed', { id: requestId, reasons });
      }
      return json(
        {
          state: reasons.length ? 'qualification_failed' : 'validation_failed',
          message: reasons.length
            ? 'Unfortunately, you don’t meet the requirements for this offer.'
            : 'Please check the highlighted fields.',
          errors,
          reasons,
        },
        422,
      );
    }
    if (typeof raw.submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.submissionId))
      return json(
        { state: 'api_rejected', message: 'Please refresh the page and try again.' },
        400,
      );
    const saved = await ingestLead(
      await leadBindings(),
      {
        source: 'WEBSITE',
        externalLeadId: raw.submissionId,
        firstname: input.firstname,
        lastname: input.lastname,
        email: input.email,
        phone: input.phone,
        contactConsent: input.terms,
        marketingConsent: null,
        consentVersion: CONSENT_VERSION,
        consentSource: 'WEBSITE',
        consentTimestamp: now.toISOString(),
        submittedAt: now.toISOString(),
        receivedAt: now.toISOString(),
        qualification: {
          age: input.age,
          vehicle: input.vehicle,
          employment: input.employment,
          income: input.income,
        },
        preferredtimeofcall: input.preferredtimeofcall,
        attribution: raw.attribution,
        eligibilityConfirmed: input.eligibilityConfirmed,
        ...microsoftWebsiteDetails(raw.attribution),
      },
      site,
    );
    if (saved.legacyResult) {
      if (saved.legacyResult.result)
        return json(JSON.parse(saved.legacyResult.result), saved.legacyResult.http_status || 200);
      return json(
        {
          ...failure,
          message:
            'Your earlier request requires a delivery check. Please wait before trying again.',
        },
        409,
      );
    }
    if (saved.status === 'not_sent_disabled')
      return json(
        { ...failure, message: 'Quote requests are not available yet. Please try again later.' },
        503,
      );
    // Success here means durable receipt, never a claim of affiliate acceptance.
    return json(
      {
        state: 'success',
        message:
          'Your request has been received for processing. A representative may contact you about your quote.',
        diagnostics: { code: 'LEAD_RECEIVED', requestId },
      },
      200,
    );
  } catch (error) {
    if (error instanceof LeadConflict)
      return json(
        {
          state: 'api_rejected',
          message: 'This request has already been used. Please refresh the page.',
        },
        409,
      );
    const code = error instanceof ConfigurationError ? error.code : 'INTERNAL_ERROR';
    log('lead_request_error', { id: requestId, diagnosticCode: code });
    return json({ ...failure, diagnostics: { code, requestId } }, 503);
  }
}

// Readiness only: never sends a lead, consumes no rate-limit attempt and reveals no env values.
export async function GET() {
  const requestId = randomUUID();
  try {
    submissionConfig();
    digest('readiness');
    await checkDatabase();
    const enabled = process.env.LEADBYTE_ENABLED === 'true';
    return jsonResponse(
      {
        ready: enabled,
        diagnostics: { code: enabled ? 'READY' : 'SUBMISSIONS_DISABLED', requestId },
      },
      enabled ? 200 : 503,
    );
  } catch (error) {
    return jsonResponse(
      {
        ready: false,
        diagnostics: {
          code: error instanceof ConfigurationError ? error.code : 'INTERNAL_ERROR',
          requestId,
        },
      },
      503,
    );
  }
}
