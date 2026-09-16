import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  claimSubmission: vi.fn(),
  completeSubmission: vi.fn(),
  submitLead: vi.fn(),
}));
vi.mock('../lib/rateLimit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('../lib/submissions', () => ({
  claimSubmission: mocks.claimSubmission,
  completeSubmission: mocks.completeSubmission,
}));
vi.mock('../lib/leadbyte', () => ({ submitLead: mocks.submitLead }));
import { POST } from '../app/api/leads/route';
import { ConfigurationError } from '../lib/diagnostics';
const valid = {
  firstname: 'Test',
  lastname: 'Testing',
  phone: '+27821234567',
  age: '18_plus',
  vehicle: 'yes',
  employment: 'employed',
  income: '10000_19999',
  terms: true,
  submissionId: 'c402a01d-3f0a-4a5c-a312-34f80b3d3a8d',
};
function request(body: unknown = valid, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('LEAD_HASH_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.claimSubmission.mockResolvedValue({ claimed: true });
  mocks.submitLead.mockResolvedValue({ state: 'success', message: 'Received', code: 1 });
});
it('accepts valid request without forwarding undocumented attribution', async () => {
  const response = await POST(
    request({ ...valid, offer_id: '999', attribution: { transaction_id: 'txn', offer_id: '999' } }),
  );
  expect(response.status).toBe(200);
  expect(mocks.submitLead.mock.calls[0][0]).not.toHaveProperty('offer_id');
});
it('records an unexpected LeadByte failure as an uncertain delivery', async () => {
  mocks.submitLead.mockRejectedValueOnce(new ConfigurationError('CONFIG_ENDPOINT_INVALID'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(mocks.completeSubmission).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ state: 'temporary_error' }),
    503,
    expect.objectContaining({
      diagnosticCode: 'CONFIG_ENDPOINT_INVALID',
      uncertain: true,
    }),
  );
});
it.each([
  ['age', 'under_18'],
  ['vehicle', 'no'],
  ['employment', 'unemployed'],
  ['income', 'under_10000'],
  ['terms', false],
  ['phone', '123'],
])('does not send invalid %s upstream', async (key, value) => {
  expect((await POST(request({ ...valid, [key]: value }))).status).toBe(422);
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
it('blocks honeypot bots', async () => {
  expect((await POST(request({ ...valid, website: 'spam' }))).status).toBe(400);
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
it('blocks cross-origin submissions', async () =>
  expect((await POST(request(valid, 'https://elsewhere.example'))).status).toBe(403));
it('rate limits safely', async () => {
  mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
  const r = await POST(request());
  expect(r.status).toBe(429);
  expect(r.headers.get('Retry-After')).toBe('30');
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
it('replays completed submissions without posting upstream again', async () => {
  const first = await POST(request());
  const claimArgs = mocks.claimSubmission.mock.calls[0];
  mocks.claimSubmission.mockResolvedValue({
    claimed: false,
    existing: {
      fingerprint: claimArgs[1],
      result: JSON.stringify({ state: 'success', message: 'Received' }),
      httpStatus: 200,
    },
  });
  const second = await POST(request());
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(mocks.submitLead).toHaveBeenCalledTimes(1);
});
it('prevents simultaneous double submission', async () => {
  let claimed = false;
  mocks.claimSubmission.mockImplementation(async (_key, fingerprint) => {
    if (claimed) return { claimed: false, existing: { fingerprint } };
    claimed = true;
    return { claimed: true };
  });
  const responses = await Promise.all([POST(request()), POST(request())]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(mocks.submitLead).toHaveBeenCalledTimes(1);
});
it('fails closed if temporary submission capacity is exhausted', async () => {
  mocks.claimSubmission.mockRejectedValueOnce(new Error('capacity'));
  expect((await POST(request())).status).toBe(503);
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
it('does not expose vendor response details', async () => {
  mocks.submitLead.mockResolvedValue({
    state: 'api_rejected',
    message: 'Check your information',
    code: -5,
    response: 'private vendor details',
  });
  const response = await POST(request());
  expect(await response.json()).toEqual({
    state: 'api_rejected',
    message: 'Check your information',
    diagnostics: { code: 'LEADBYTE_REJECTED', leadByteCode: -5, requestId: expect.any(String) },
  });
});
it('refuses oversized request bodies', async () => {
  expect((await POST(request({ ...valid, excess: 'x'.repeat(17000) }))).status).toBe(400);
  expect(mocks.submitLead).not.toHaveBeenCalled();
});
