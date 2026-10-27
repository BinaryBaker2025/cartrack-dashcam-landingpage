export const UET_TAG_ID = '187282616';
export const AD_CONSENT_KEY = 'bestcardash-ad-consent-v1';
export type AdConsent = 'granted' | 'denied';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    uetq?: { push: (...args: unknown[]) => unknown };
    bestcardashAdConsent?: AdConsent;
  }
}

// Default consent is queued before the asynchronous Microsoft library can send a page view.
export const uetBootstrap = `
window.uetq=window.uetq||[];
window.bestcardashAdConsent='denied';
window.uetq.push('consent','default',{ad_storage:'denied'});
try {
  if(localStorage.getItem('${AD_CONSENT_KEY}')==='granted') {
    window.bestcardashAdConsent='granted';
    window.uetq.push('consent','update',{ad_storage:'granted'});
  }
} catch(e) {}
(function(w,d,t,u,o){
  w[u]=w[u]||[];o.ts=(new Date).getTime();
  var n=d.createElement(t);
  n.src='https://bat.bing.net/bat.js?ti='+o.ti;
  n.async=1;
  n.onload=n.onreadystatechange=function(){
    var s=this.readyState;
    if(!s||s==='loaded'||s==='complete'){
      o.q=w[u];w[u]=new UET(o);w[u].push('pageLoad');
      n.onload=n.onreadystatechange=null;
    }
  };
  var i=d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n,i);
})(window,document,'script','uetq',{ti:'${UET_TAG_ID}',enableAutoSpaTracking:true});
`;

export function updateAdConsent(choice: AdConsent) {
  window.bestcardashAdConsent = choice;
  try {
    localStorage.setItem(AD_CONSENT_KEY, choice);
  } catch {
    // The choice still applies for this document when storage is unavailable.
  }
  window.uetq?.push('consent', 'update', { ad_storage: choice });
  window.gtag?.('consent', 'update', {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  });
}

export function trackMicrosoftLead(email: string | undefined, phone: string) {
  try {
    if (typeof window === 'undefined' || window.bestcardashAdConsent !== 'granted') return;
    // UET normalises and hashes these identifiers for enhanced conversions.
    // Never put contact details in event properties, URLs or our analytics endpoint.
    const normalizedEmail = email?.trim().toLowerCase();
    window.uetq?.push('set', {
      pid: { ...(normalizedEmail ? { em: normalizedEmail } : {}), ph: phone },
    });
    window.uetq?.push('event', 'lead_submit_success', {});
  } catch {
    // Advertising must never interrupt a successful lead.
  }
}
