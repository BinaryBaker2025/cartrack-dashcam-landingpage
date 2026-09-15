import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPayload, formatSaDate, parseLeadByte, submitLead } from '../lib/leadbyte';
import { submissionConfig } from '../lib/config';
import { valid } from './fixtures';
afterEach(() => vi.unstubAllEnvs());
describe('LeadByte response handling', () => {
  it('retains vendor reporting fields and raw response for reconciliation', async () => {
    const raw = JSON.stringify({
      code: -8,
      response: 'HLR rejection',
      leadId: null,
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
      timestamp: '2026-09-15T12:00:00Z',
      processTime: 0.77,
    });
    const result = await submitLead(
      valid,
      new Date(),
      vi.fn().mockResolvedValue(new Response(raw)),
    );
    expect(result).toMatchObject({
      code: -8,
      response: 'HLR rejection',
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
      timestamp: '2026-09-15T12:00:00Z',
      processTime: 0.77,
      rawResponse: raw,
      upstreamStatus: 200,
    });
    expect(result.leadId).toBeUndefined();
  });
  it('never reports success for an HTTP error even if its body claims code 1', async () => {
    const result = await submitLead(
      valid,
      new Date(),
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 1, response: 'OK', leadId: 123 }, { status: 502 }),
        ),
    );
    expect(result).toMatchObject({
      state: 'temporary_error',
      uncertain: true,
      code: 1,
      leadId: '123',
      upstreamStatus: 502,
    });
  });
  it.each([
    [1, 'success'],
    [-2, 'duplicate'],
    [-5, 'api_rejected'],
    [-3, 'temporary_error'],
    [-100, 'temporary_error'],
  ])('handles code %s as %s', (code, state) =>
    expect(parseLeadByte({ code, response: code === 1 ? 'OK' : 'Rejected' }).state).toBe(state),
  );
  it.each([-9, -8, -7, -6, -4, -19, -17, -16, -15, -14, -13, -12, -11, -10])(
    'handles rejection %s safely',
    (code) => {
      const r = parseLeadByte({ code, response: 'Internal secret' });
      expect(r.state).toBe('api_rejected');
      expect(r.message).not.toContain('Internal secret');
    },
  );
  it.each([null, {}, '<html>fail</html>', { code: '1', response: 'OK' }, { code: 1 }])(
    'rejects malformed response %j',
    (data) => expect(parseLeadByte(data).state).toBe('temporary_error'),
  );
  it('handles timeout safely even if fetch never settles', async () => {
    vi.stubEnv('LEADBYTE_TIMEOUT_MS', '10');
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const result = await submitLead(valid, new Date(), fetcher);
    expect(result.state).toBe('temporary_error');
    expect(result.uncertain).toBe(true);
  });
  it('handles non-JSON upstream body', async () => {
    const r = await submitLead(
      valid,
      new Date(),
      vi.fn().mockResolvedValue(new Response('bad json')),
    );
    expect(r.state).toBe('temporary_error');
  });
  it('handles network rejection', async () =>
    expect(
      (await submitLead(valid, new Date(), vi.fn().mockRejectedValue(new Error('network')))).state,
    ).toBe('temporary_error'));
  it('sends POST form encoding with fixed campaign settings', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ code: 1, response: 'OK', leadId: 123 }));
    const result = await submitLead(valid, new Date('2026-09-14T10:00:00Z'), mock);
    expect(result.state).toBe('success');
    const [url, options] = mock.mock.calls[0];
    expect(String(url)).toContain('campid=DASHCAMS&sid=27144&returnjson=yes');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(options.body.get('offer_id')).toBe('3046');
    expect(options.body.has('transaction_id')).toBe(false);
  });
});
describe('payload integrity', () => {
  it('offer_id always remains 3046 despite query/body overrides', () => {
    const body = { ...valid, offer_id: '999', attribution: { offer_id: '999' } };
    expect(buildPayload(body, 'https://example.co.za', new Date()).get('offer_id')).toBe('3046');
  });
  it('rejects an environment campaign override', () => {
    vi.stubEnv('LEADBYTE_OFFER_ID', '999');
    expect(submissionConfig).toThrow();
  });
  it('formats consent in South African local time', () =>
    expect(formatSaDate(new Date('2026-01-01T23:05:09Z'))).toBe('02/01/2026 01:05:09'));
  it('uses our landing page and omits absent call time', () => {
    const p = buildPayload(valid, 'https://example.co.za', new Date());
    expect(p.get('optinurl')).toBe('https://example.co.za/');
    expect(p.has('preferredtimeofcall')).toBe(false);
  });
  it('formats preferred time as South African local time', () =>
    expect(
      buildPayload(
        { ...valid, preferredtimeofcall: '2026-12-12T14:30' },
        'https://example.co.za',
        new Date(),
      ).get('preferredtimeofcall'),
    ).toBe('12/12/2026 14:30:00'));
});
