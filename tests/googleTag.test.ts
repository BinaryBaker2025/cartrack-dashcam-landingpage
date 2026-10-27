import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import {
  googleTagBootstrap,
  GOOGLE_ADS_LEAD_CONVERSION,
  GOOGLE_ADS_TAG_ID,
  trackGoogleAdsLeadConversion,
} from '../lib/googleTag';
import { updateAdConsent } from '../lib/uet';

afterEach(() => vi.unstubAllGlobals());

it('queues denied consent before configuration and restores saved consent', () => {
  for (const saved of [null, 'granted', 'denied']) {
    const window = { dataLayer: [] as IArguments[] };
    runInNewContext(googleTagBootstrap, { window, localStorage: { getItem: () => saved } });
    const calls = window.dataLayer.map((args) => Array.from(args));
    expect(calls[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(calls.at(-1)).toEqual(['config', GOOGLE_ADS_TAG_ID]);
    expect(calls.some((call) => call[1] === 'update')).toBe(saved === 'granted');
  }
});

it('updates Google consent when accepting or withdrawing advertising permission', () => {
  const gtag = vi.fn();
  vi.stubGlobal('window', { gtag });
  vi.stubGlobal('localStorage', { setItem: vi.fn() });
  for (const choice of ['granted', 'denied'] as const) {
    updateAdConsent(choice);
    expect(gtag).toHaveBeenLastCalledWith('consent', 'update', {
      ad_storage: choice,
      ad_user_data: choice,
      ad_personalization: choice,
    });
  }
});

it('sends the configured Google Ads conversion without interrupting the lead flow', () => {
  const gtag = vi.fn();
  vi.stubGlobal('window', { gtag });

  trackGoogleAdsLeadConversion();

  expect(gtag).toHaveBeenCalledOnce();
  expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
    send_to: GOOGLE_ADS_LEAD_CONVERSION,
  });

  vi.stubGlobal('window', {
    gtag: () => {
      throw new Error('unavailable');
    },
  });
  expect(() => trackGoogleAdsLeadConversion()).not.toThrow();
});
