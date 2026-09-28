import { sanitizeAttribution } from './attribution';
import type { LeadRequest } from './leadModel';

// Website acquisition metadata, not a claim of an authenticated Microsoft webhook.
// Keep source=WEBSITE and its submission-token idempotency unchanged.
export function microsoftWebsiteDetails(
  raw: unknown,
): Pick<LeadRequest, 'campaignId' | 'campaignName' | 'adGroupId' | 'adId' | 'metadata'> {
  const attribution = sanitizeAttribution(raw);
  const source = attribution.utm_source?.toLowerCase();
  const microsoftSource = !!source && ['bing', 'microsoft', 'microsoft_ads'].includes(source);
  const paid = ['cpc', 'ppc', 'paidsearch', 'paid_search'].includes(
    attribution.utm_medium?.toLowerCase() || '',
  );
  if ((source && !microsoftSource) || !(attribution.msclkid || (microsoftSource && paid)))
    return {};
  return {
    campaignId: attribution.ms_campaign_id,
    campaignName: attribution.utm_campaign,
    adGroupId: attribution.ms_adgroup_id,
    adId: attribution.ms_ad_id,
    metadata: {
      acquisitionSource: 'MICROSOFT_ADS',
      attributionEvidence: attribution.msclkid ? 'url_click_id' : 'url_utm',
    },
  };
}
