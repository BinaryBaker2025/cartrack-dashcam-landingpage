import { AD_CONSENT_KEY } from './uet';

declare global {
  interface Window {
    dataLayer?: IArguments[];
  }
}

export const GOOGLE_ADS_TAG_ID = 'AW-18532625097';
export const GOOGLE_ADS_LEAD_CONVERSION = `${GOOGLE_ADS_TAG_ID}/iwunCMSnqasdEMnVhYVF`;

export function trackGoogleAdsLeadConversion() {
  try {
    if (typeof window === 'undefined') return;
    window.gtag?.('event', 'conversion', { send_to: GOOGLE_ADS_LEAD_CONVERSION });
  } catch {
    // Advertising must never interrupt a successful lead.
  }
}

export const googleTagBootstrap = `
window.dataLayer=window.dataLayer||[];
window.gtag=function(){window.dataLayer.push(arguments);};
window.gtag('consent','default',{
  ad_storage:'denied',analytics_storage:'denied',
  ad_user_data:'denied',ad_personalization:'denied'
});
try {
  if(localStorage.getItem('${AD_CONSENT_KEY}')==='granted') {
    window.gtag('consent','update',{
      ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'
    });
  }
} catch(e) {}
window.gtag('js',new Date());
window.gtag('config','${GOOGLE_ADS_TAG_ID}');
`;
