import { ConfigurationError } from './diagnostics';
export const OFFER_ID = '3046';
export const CONSENT_VERSION = '2026-09-15-v2';
// Public operator details supplied by the campaign owner, not API credentials.
export function campaignIdentity() {
  return {
    name: process.env.CAMPAIGN_OPERATOR_NAME?.trim() || 'SHYINC',
    email: process.env.PRIVACY_CONTACT_EMAIL?.trim() || 'admin@shyinc.com',
  };
}
export function siteUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== 'production'
      ? 'http://localhost:3000'
      : 'https://unconfigured.invalid');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError('CONFIG_SITE_URL_INVALID');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new ConfigurationError('CONFIG_SITE_URL_INVALID');
  return url.origin;
}
export function submissionConfig() {
  const site = siteUrl();
  const identity = campaignIdentity();
  if (
    process.env.NODE_ENV === 'production' &&
    (!site.startsWith('https://') ||
      /localhost|127\.0\.0\.1|your-domain\.co\.za|unconfigured\.invalid/.test(site))
  )
    throw new ConfigurationError('CONFIG_SITE_URL_REQUIRED');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LEADBYTE_ENABLED === 'true' &&
    !identity.name
  )
    throw new ConfigurationError('CONFIG_OPERATOR_NAME_REQUIRED');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LEADBYTE_ENABLED === 'true' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)
  )
    throw new ConfigurationError('CONFIG_PRIVACY_EMAIL_REQUIRED');
  if (process.env.LEADBYTE_OFFER_ID && process.env.LEADBYTE_OFFER_ID !== OFFER_ID)
    throw new ConfigurationError('CONFIG_OFFER_MISMATCH');
  let endpoint: URL;
  try {
    endpoint = new URL(
      process.env.LEADBYTE_ENDPOINT || 'https://returnxdigital.leadbyte.co.uk/api/submit.php',
    );
  } catch {
    throw new ConfigurationError('CONFIG_ENDPOINT_INVALID');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'returnxdigital.leadbyte.co.uk' ||
    endpoint.pathname !== '/api/submit.php'
  )
    throw new ConfigurationError('CONFIG_ENDPOINT_INVALID');
  if (
    (process.env.LEADBYTE_CAMPID || 'DASHCAMS') !== 'DASHCAMS' ||
    (process.env.LEADBYTE_SID || '27144') !== '27144'
  )
    throw new ConfigurationError('CONFIG_CAMPAIGN_MISMATCH');
  endpoint.search = new URLSearchParams({
    campid: 'DASHCAMS',
    sid: '27144',
    returnjson: 'yes',
  }).toString();
  return { endpoint, site };
}
