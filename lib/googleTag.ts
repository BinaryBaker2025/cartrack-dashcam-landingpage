import { AD_CONSENT_KEY } from './uet';

export const GOOGLE_ADS_TAG_ID = 'AW-18532625097';

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
