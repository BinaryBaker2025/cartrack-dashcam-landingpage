import { OFFER_ID, submissionConfig } from './config';
import { type LeadInput, parseCallTime } from './validation';
export type LeadResult = {
  state: 'success' | 'duplicate' | 'api_rejected' | 'temporary_error';
  message: string;
  code?: number;
  leadId?: string;
  response?: string;
  uncertain?: boolean;
};
export function formatSaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
export function buildPayload(input: LeadInput, site: string, now: Date) {
  const payload = new URLSearchParams({
    firstname: input.firstname,
    lastname: input.lastname,
    phone1: input.phone,
    optinurl: `${site}/`,
    optindate: formatSaDate(now),
    acceptterms: 'true',
    offer_id: OFFER_ID,
  });
  if (input.preferredtimeofcall)
    payload.set('preferredtimeofcall', formatSaDate(parseCallTime(input.preferredtimeofcall)!));
  return payload;
}
const temporary = "We couldn't submit your request right now. Please try again shortly.";
export function parseLeadByte(raw: unknown): LeadResult {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('code' in raw) ||
    typeof raw.code !== 'number' ||
    !Number.isInteger(raw.code) ||
    !('response' in raw) ||
    typeof raw.response !== 'string'
  )
    return { state: 'temporary_error', message: temporary, uncertain: true };
  const data = raw as { code: number; response: string; leadId?: unknown };
  const base = { code: data.code, response: data.response };
  if (data.code === 1)
    return {
      ...base,
      state: 'success',
      message:
        'Your request has been received. A CarTrack representative may contact you about your quote.',
      leadId:
        typeof data.leadId === 'number' || typeof data.leadId === 'string'
          ? String(data.leadId).slice(0, 80)
          : undefined,
    };
  if (data.code === -2)
    return {
      ...base,
      state: 'duplicate',
      message: 'It looks like your details have already been submitted recently.',
    };
  if ([-3, -100].includes(data.code))
    return { ...base, state: 'temporary_error', message: temporary };
  const messages: Record<number, string> = {
    [-9]: 'This offer is currently unavailable. Please try again later.',
    [-8]: 'Please check your mobile number and try again.',
    [-7]: 'This offer is currently unavailable. Please try again later.',
    [-6]: 'We’re unable to process your request for this offer.',
    [-5]: 'Please check your information and try again.',
    [-4]: 'We’re unable to take more requests right now. Please try again later.',
    [-19]: 'This offer is currently unavailable. Please try again later.',
    [-17]: 'We’re unable to contact you because of your contact preferences.',
    [-16]: 'We’re unable to contact you because of your contact preferences.',
    [-15]: 'We’re unable to contact you because of your contact preferences.',
    [-14]: 'This offer is available in South Africa only.',
    [-13]: 'Please use a South African mobile number rather than a landline.',
    [-12]: 'Please check your information and try again.',
    [-11]: 'We’re unable to process your request right now.',
    [-10]: 'Please check your information and try again.',
  };
  return {
    ...base,
    state: 'api_rejected',
    message: messages[data.code] || 'We’re unable to process your request for this offer.',
  };
}
export async function submitLead(
  input: LeadInput,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<LeadResult> {
  const { endpoint, site } = submissionConfig();
  const configured = Number(process.env.LEADBYTE_TIMEOUT_MS || 10000);
  const timeout = Number.isFinite(configured) ? Math.min(20000, Math.max(10, configured)) : 10000;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: buildPayload(input, site, now),
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        if (!response.ok)
          return { state: 'temporary_error', message: temporary, uncertain: true } as LeadResult;
        const text = await response.text();
        if (text.length > 64000) throw new Error('Oversized response');
        return parseLeadByte(JSON.parse(text));
      })(),
      new Promise<LeadResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({
            state: 'temporary_error',
            message: "We couldn't confirm your request. Please wait before trying again.",
            uncertain: true,
          });
        }, timeout);
      }),
    ]);
  } catch {
    return { state: 'temporary_error', message: temporary, uncertain: true };
  } finally {
    clearTimeout(timer);
  }
}
