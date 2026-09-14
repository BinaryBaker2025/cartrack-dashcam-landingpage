import { cleanText } from './validation';
export const attributionKeys = [
  'affiliate_id',
  'offer_id',
  'transaction_id',
  'aff_sub',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
export type Attribution = Partial<Record<(typeof attributionKeys)[number], string>>;
export function sanitizeAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    attributionKeys
      .map((key) => [key, cleanText((raw as Record<string, unknown>)[key], 200)])
      .filter(([, value]) => value),
  );
}
export function captureAttribution(search: string, previous: Attribution = {}): Attribution {
  const params = new URLSearchParams(search);
  const incoming = sanitizeAttribution(Object.fromEntries(params));
  if (!incoming.affiliate_id && params.has('aff_id'))
    incoming.affiliate_id = cleanText(params.get('aff_id'), 200);
  return { ...previous, ...incoming };
}
let memory: Attribution = {};
export function sessionAttribution(search?: string): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    memory = sanitizeAttribution(
      JSON.parse(sessionStorage.getItem('cartrack-attribution') || '{}'),
    );
  } catch {
    /* Storage may be disabled. */
  }
  memory = captureAttribution(search ?? window.location.search, memory);
  try {
    sessionStorage.setItem('cartrack-attribution', JSON.stringify(memory));
  } catch {
    /* Memory fallback. */
  }
  return memory;
}
