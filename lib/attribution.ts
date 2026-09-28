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
  'msclkid',
  'ms_campaign_id',
  'ms_adgroup_id',
  'ms_ad_id',
] as const;
export type Attribution = Partial<Record<(typeof attributionKeys)[number], string>>;
const microsoftKeys = ['msclkid', 'ms_campaign_id', 'ms_adgroup_id', 'ms_ad_id'] as const;
function attributionValue(key: (typeof attributionKeys)[number], value: unknown) {
  if (typeof value !== 'string') return '';
  // Reject rather than truncate identifiers or accept unresolved ad URL macros.
  const trimmed = value.trim();
  if (key === 'msclkid')
    return /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(trimmed)
      ? trimmed
      : '';
  if (key.startsWith('ms_')) return /^\d{1,20}$/.test(trimmed) ? trimmed : '';
  return cleanText(value, 200);
}
export function sanitizeAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    attributionKeys
      .map((key) => [key, attributionValue(key, (raw as Record<string, unknown>)[key])])
      .filter(([, value]) => value),
  );
}
export function captureAttribution(search: string, previous: Attribution = {}): Attribution {
  const params = new URLSearchParams(search);
  const incoming = sanitizeAttribution(Object.fromEntries(params));
  if (!incoming.affiliate_id && params.has('aff_id'))
    incoming.affiliate_id = cleanText(params.get('aff_id'), 200);
  const retained = sanitizeAttribution(previous);
  // Keep attribution across ordinary navigation, but never attach a previous
  // Microsoft click/campaign to a new paid click or a different campaign.
  const newTouch = [
    'utm_source',
    'utm_campaign',
    'gclid',
    'gbraid',
    'wbraid',
    'fbclid',
    ...microsoftKeys,
  ].some((key) => params.has(key));
  if (newTouch) {
    for (const key of [
      ...microsoftKeys,
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ] as const)
      delete retained[key];
  }
  return { ...retained, ...incoming };
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
