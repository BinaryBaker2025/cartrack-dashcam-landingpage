import { afterEach, expect, it, vi } from 'vitest';
import { trackMicrosoftLead, updateAdConsent } from '../lib/uet';

afterEach(() => vi.unstubAllGlobals());

it('does not send contact identifiers or conversions without advertising consent', () => {
  const push = vi.fn();
  vi.stubGlobal('window', { uetq: { push } });
  trackMicrosoftLead('test@example.com', '+27821234567');
  expect(push).not.toHaveBeenCalled();
  window.bestcardashAdConsent = 'denied';
  trackMicrosoftLead('test@example.com', '+27821234567');
  expect(push).not.toHaveBeenCalled();
});

it('sends identifiers before the successful lead event and stops after withdrawal', () => {
  const push = vi.fn();
  vi.stubGlobal('window', { uetq: { push } });
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', { setItem });
  updateAdConsent('granted');
  trackMicrosoftLead(' Test@Example.com ', '+27821234567');
  expect(push.mock.calls).toEqual([
    ['consent', 'update', { ad_storage: 'granted' }],
    ['set', { pid: { em: 'test@example.com', ph: '+27821234567' } }],
    ['event', 'lead_submit_success', {}],
  ]);
  updateAdConsent('denied');
  trackMicrosoftLead('test@example.com', '+27821234567');
  expect(push).toHaveBeenCalledTimes(4);
  expect(setItem).toHaveBeenLastCalledWith('bestcardash-ad-consent-v1', 'denied');
});

it('sends phone-only identifiers when the lead has no email address', () => {
  const push = vi.fn();
  vi.stubGlobal('window', { bestcardashAdConsent: 'granted', uetq: { push } });

  trackMicrosoftLead(undefined, '+27821234567');

  expect(push.mock.calls).toEqual([
    ['set', { pid: { ph: '+27821234567' } }],
    ['event', 'lead_submit_success', {}],
  ]);
});

it('consent works with blocked storage and tracking failures cannot break a lead', () => {
  vi.stubGlobal('window', { uetq: { push: vi.fn() } });
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('blocked');
    },
  });
  expect(() => updateAdConsent('granted')).not.toThrow();
  window.uetq = {
    push: () => {
      throw new Error('unavailable');
    },
  };
  expect(() => trackMicrosoftLead(undefined, '+27821234567')).not.toThrow();
});
