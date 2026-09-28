import { afterEach, expect, it, vi } from 'vitest';
import { captureAttribution, sanitizeAttribution, sessionAttribution } from '../lib/attribution';
import { microsoftWebsiteDetails } from '../lib/microsoftAds';

const clickId = '0123456789abcdef0123456789abcdef';
const search = `?utm_source=bing&utm_medium=cpc&utm_campaign=bestcardash_dashcam&msclkid=${clickId}&ms_campaign_id=123&ms_adgroup_id=456&ms_ad_id=789&utm_term=dashcam`;
afterEach(() => vi.unstubAllGlobals());

it('captures Bing click and campaign identifiers and maps only acquisition metadata', () => {
  const attribution = captureAttribution(search);
  expect(attribution).toMatchObject({
    msclkid: clickId,
    ms_campaign_id: '123',
    ms_adgroup_id: '456',
    ms_ad_id: '789',
    utm_term: 'dashcam',
  });
  const details = microsoftWebsiteDetails(attribution);
  expect(details).toMatchObject({
    campaignId: '123',
    campaignName: 'bestcardash_dashcam',
    adGroupId: '456',
    adId: '789',
    metadata: { acquisitionSource: 'MICROSOFT_ADS', attributionEvidence: 'url_click_id' },
  });
  expect(details).not.toHaveProperty('source');
  expect(details).not.toHaveProperty('externalLeadId');
  expect(details).not.toHaveProperty('contactConsent');
  expect(details).not.toHaveProperty('marketingConsent');
});
it('recognises a click ID without optional UTMs', () => {
  expect(microsoftWebsiteDetails({ msclkid: clickId }).metadata?.acquisitionSource).toBe(
    'MICROSOFT_ADS',
  );
});
it('recognises paid Bing UTMs without fabricating a missing click ID', () => {
  const attribution = captureAttribution('?utm_source=bing&utm_medium=cpc');
  expect(attribution.msclkid).toBeUndefined();
  expect(microsoftWebsiteDetails(attribution).metadata?.attributionEvidence).toBe('url_utm');
});
it.each(['01234567-89ab-cdef-0123-456789abcdef', clickId.toUpperCase()])(
  'preserves supported ID format %s',
  (id) => {
    expect(sanitizeAttribution({ msclkid: id }).msclkid).toBe(id);
  },
);
it.each([
  '{msclkid}',
  'invalid',
  'test@example.com',
  '0'.repeat(33),
  '<0123456789abcdef0123456789abcdef>',
])('rejects malformed click ID %s', (id) => {
  expect(sanitizeAttribution({ msclkid: id }).msclkid).toBeUndefined();
});
it('rejects unresolved campaign macros, non-string and oversized IDs without truncation', () => {
  expect(
    sanitizeAttribution({
      ms_campaign_id: '{CampaignId}',
      ms_adgroup_id: 123,
      ms_ad_id: '1'.repeat(21),
    }),
  ).toEqual({});
  expect(sanitizeAttribution({ ms_campaign_id: '9223372036854775807' }).ms_campaign_id).toBe(
    '9223372036854775807',
  );
});
it.each([
  { utm_source: 'bing', utm_medium: 'organic' },
  { utm_source: 'google', utm_medium: 'cpc', msclkid: clickId },
  { ms_campaign_id: '123' },
  {},
])('does not mislabel unrelated/ambiguous attribution %j', (input) => {
  expect(microsoftWebsiteDetails(input)).toEqual({});
});
it('retains attribution through normal navigation', () => {
  const saved = captureAttribution(search);
  expect(captureAttribution('', saved)).toEqual(saved);
  expect(captureAttribution('?unrelated=value', saved)).toEqual(saved);
});
it('does not carry a Microsoft click or campaign onto a later Google visit', () => {
  const saved = captureAttribution(search);
  expect(
    captureAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=new&gclid=opaque', saved),
  ).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'new' });
});
it('clears stale click/campaign IDs for a new Bing campaign without MSCLKID', () => {
  expect(
    captureAttribution(
      '?utm_source=bing&utm_medium=cpc&utm_campaign=second',
      captureAttribution(search),
    ),
  ).toEqual({ utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'second' });
});
it('new Microsoft clicks do not inherit previous campaign details', () => {
  expect(captureAttribution(`?msclkid=${'a'.repeat(32)}`, captureAttribution(search))).toEqual({
    msclkid: 'a'.repeat(32),
  });
});
it('re-sanitises stale session data and ignores consent, customer and provider overrides', () => {
  expect(captureAttribution('', { msclkid: 'bad', utm_source: 'bing' })).toEqual({
    utm_source: 'bing',
  });
  expect(
    sanitizeAttribution({
      phone: 'private',
      source: 'MICROSOFT_ADS',
      terms: true,
      marketingConsent: true,
      externalLeadId: 'forged',
      msclkid: clickId,
    }),
  ).toEqual({ msclkid: clickId });
});
it('stores and retrieves the Bing click from the existing browser session', () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) || null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  expect(sessionAttribution().msclkid).toBe(clickId);
  expect(sessionAttribution('').ms_campaign_id).toBe('123');
  expect(saved.get('cartrack-attribution')).toContain(clickId);
});
