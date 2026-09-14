import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clientAddress, isIndexable } from '../lib/hosting';

beforeEach(() => {
  for (const name of ['SITE_INDEXABLE', 'CONTEXT', 'VERCEL_ENV', 'VERCEL', 'DEPLOY_PLATFORM'])
    vi.stubEnv(name, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('allows indexing only for explicitly enabled Netlify production', () => {
  vi.stubEnv('SITE_INDEXABLE', 'true');
  vi.stubEnv('CONTEXT', 'production');
  expect(isIndexable()).toBe(true);
});
it('keeps Netlify previews noindex even with conflicting Vercel configuration', () => {
  vi.stubEnv('SITE_INDEXABLE', 'true');
  vi.stubEnv('CONTEXT', 'deploy-preview');
  vi.stubEnv('VERCEL_ENV', 'production');
  expect(isIndexable()).toBe(false);
});
it('keeps local builds and disabled production noindex', () => {
  expect(isIndexable()).toBe(false);
  vi.stubEnv('CONTEXT', 'production');
  expect(isIndexable()).toBe(false);
});
it('uses Netlify client IP rather than spoofable forwarded-for', () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'netlify');
  expect(
    clientAddress(
      new Request('https://example.com', {
        headers: { 'x-nf-client-connection-ip': '192.0.2.1', 'x-forwarded-for': 'fake' },
      }),
    ),
  ).toBe('192.0.2.1');
});
it('does not trust Netlify headers on a local server', () => {
  expect(
    clientAddress(
      new Request('http://localhost', { headers: { 'x-nf-client-connection-ip': 'fake' } }),
    ),
  ).toBe('local-shared');
});
