import { afterEach, expect, it, vi } from 'vitest';
import { ConfigurationError, reportDiagnostic } from '../lib/diagnostics';
import { submissionConfig } from '../lib/config';
import { GET } from '../app/api/leads/route';
import { parseLeadByte, submitLead } from '../lib/leadbyte';
import { valid } from './fixtures';
import { checkDatabase } from '../lib/database';
vi.mock('../lib/database', () => ({ checkDatabase: vi.fn().mockResolvedValue(undefined) }));
it('readiness fails if the database is unavailable without exposing its error', async () => {
  production();
  vi.mocked(checkDatabase).mockRejectedValueOnce(new Error('private database details'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('private database details');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function production() {
  vi.stubEnv('LEAD_HASH_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.netlify.app');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('CAMPAIGN_OPERATOR_NAME', 'Test operator');
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', 'test@example.com');
}
it('uses the owner-supplied identity when Netlify operator settings are empty', async () => {
  production();
  vi.stubEnv('CAMPAIGN_OPERATOR_NAME', '');
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', '');
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).diagnostics.code).toBe('READY');
});
it('reports an invalid privacy email override specifically', () => {
  production();
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', 'not-an-email');
  expect(submissionConfig).toThrow(new ConfigurationError('CONFIG_PRIVACY_EMAIL_REQUIRED'));
});
it('reports localhost production configuration specifically', () => {
  production();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  expect(submissionConfig).toThrow(new ConfigurationError('CONFIG_SITE_URL_REQUIRED'));
});
it('readiness does not make any network call or expose configuration values', async () => {
  production();
  const spy = vi.spyOn(globalThis, 'fetch');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ready: true,
    diagnostics: { code: 'READY', requestId: expect.any(String) },
  });
  expect(spy).not.toHaveBeenCalled();
});
it('console diagnostics discard all contact details and vendor response text', () => {
  const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
  reportDiagnostic(
    { code: 'LEADBYTE_REJECTED', leadByteCode: -5, phone: valid.phone, response: 'private' },
    422,
  );
  expect(spy).toHaveBeenCalledWith('[CarTrack lead diagnostic]', {
    code: 'LEADBYTE_REJECTED',
    leadByteCode: -5,
    httpStatus: 422,
  });
});
it('distinguishes malformed vendor output', () =>
  expect(parseLeadByte('invalid').diagnosticCode).toBe('LEADBYTE_MALFORMED_RESPONSE'));
it('distinguishes upstream HTTP errors', async () => {
  const result = await submitLead(
    valid,
    new Date(),
    vi.fn().mockResolvedValue(new Response('private body', { status: 502 })),
  );
  expect(result.diagnosticCode).toBe('LEADBYTE_HTTP_ERROR');
  expect(result.upstreamStatus).toBe(502);
  expect(result.response).toBeUndefined();
});
it('distinguishes network failures', async () => {
  expect(
    (await submitLead(valid, new Date(), vi.fn().mockRejectedValue(new Error('secret'))))
      .diagnosticCode,
  ).toBe('LEADBYTE_NETWORK_ERROR');
});
it('distinguishes timeout', async () => {
  vi.stubEnv('LEADBYTE_TIMEOUT_MS', '10');
  expect(
    (
      await submitLead(
        valid,
        new Date(),
        vi.fn(() => new Promise<Response>(() => {})),
      )
    ).diagnosticCode,
  ).toBe('LEADBYTE_TIMEOUT');
});
