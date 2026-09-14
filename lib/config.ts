export const OFFER_ID = '3046';
export const CONSENT_VERSION = '2026-09-14-v1';
export function siteUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : 'https://your-domain.co.za');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid site URL');
  return url.origin;
}
export function submissionConfig() {
  const site = siteUrl();
  if (
    process.env.NODE_ENV === 'production' &&
    (!site.startsWith('https://') || /localhost|127\.0\.0\.1|your-domain\.co\.za/.test(site))
  )
    throw new Error('Production site URL required');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LEADBYTE_ENABLED === 'true' &&
    (!process.env.CAMPAIGN_OPERATOR_NAME ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.PRIVACY_CONTACT_EMAIL || ''))
  )
    throw new Error('Campaign operator and privacy contact required');
  if (process.env.LEADBYTE_OFFER_ID && process.env.LEADBYTE_OFFER_ID !== OFFER_ID)
    throw new Error('Campaign offer mismatch');
  const endpoint = new URL(
    process.env.LEADBYTE_ENDPOINT || 'https://returnxdigital.leadbyte.co.uk/api/submit.php',
  );
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'returnxdigital.leadbyte.co.uk' ||
    endpoint.pathname !== '/api/submit.php'
  )
    throw new Error('Unapproved LeadByte endpoint');
  if (
    (process.env.LEADBYTE_CAMPID || 'DASHCAMS') !== 'DASHCAMS' ||
    (process.env.LEADBYTE_SID || '27144') !== '27144'
  )
    throw new Error('Campaign mismatch');
  endpoint.search = new URLSearchParams({
    campid: 'DASHCAMS',
    sid: '27144',
    returnjson: 'yes',
  }).toString();
  return { endpoint, site };
}
