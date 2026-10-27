'use client';

import { useState, useSyncExternalStore } from 'react';
import { AD_CONSENT_KEY, updateAdConsent, type AdConsent } from '@/lib/uet';

function subscribe(notify: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== AD_CONSENT_KEY && event.key !== null) return;
    // A withdrawal in another tab must also stop enhanced conversions here.
    updateAdConsent(event.newValue === 'granted' ? 'granted' : 'denied');
    notify();
  }
  window.addEventListener('storage', onStorage);
  window.addEventListener('advertising-consent-change', notify);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('advertising-consent-change', notify);
  };
}
function hasChoice() {
  try {
    const stored = localStorage.getItem(AD_CONSENT_KEY);
    return stored === 'granted' || stored === 'denied';
  } catch {
    return false;
  }
}
export default function AdvertisingConsent() {
  const storedChoice = useSyncExternalStore(subscribe, hasChoice, () => true);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(false);
  function choose(choice: AdConsent) {
    updateAdConsent(choice);
    setChosen(true);
    window.dispatchEvent(new Event('advertising-consent-change'));
    setOpen(false);
  }
  return (
    <aside aria-label="Advertising privacy" className="advertising-consent">
      {open || (!storedChoice && !chosen) ? (
        <section aria-labelledby="advertising-consent-title" className="advertising-consent-panel">
          <h2 id="advertising-consent-title">Your advertising preferences</h2>
          <p>
            Allow Google and Microsoft Advertising cookies, and Microsoft&apos;s use of your phone
            number to measure successful quote requests and improve advertising? This is optional
            and separate from permission to call you. <a href="/privacy">Privacy notice</a>
          </p>
          <div>
            <button type="button" onClick={() => choose('denied')}>
              Decline advertising
            </button>
            <button type="button" onClick={() => choose('granted')}>
              Accept advertising
            </button>
          </div>
        </section>
      ) : (
        <button type="button" className="advertising-settings" onClick={() => setOpen(true)}>
          Advertising preferences
        </button>
      )}
    </aside>
  );
}
