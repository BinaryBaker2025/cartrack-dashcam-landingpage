import { expect, it } from 'vitest';
import { reconcile } from '../lib/reconciliation.mjs';

it('matches exact IDs and flags different codes/phones', () => {
  const result = reconcile(
    [
      { request_id: 'a', leadbyte_lead_id: '123', phone1: '+27821234567', leadbyte_code: 1 },
      { request_id: 'b', leadbyte_lead_id: '456', phone1: '+27821234567', leadbyte_code: -8 },
    ],
    [
      { leadId: 123, phone1: '0821234567', code: 1 },
      { leadId: 456, code: 1 },
    ],
  );
  expect(result.results.map((row: { status: string }) => row.status)).toEqual([
    'matched_id',
    'matched_id_data_mismatch',
  ]);
});
it('treats phone-only matches as candidates and missing import rows as inconclusive', () => {
  const result = reconcile(
    [
      { request_id: 'a', leadbyte_lead_id: null, phone1: '+27821234567' },
      { request_id: 'b', leadbyte_lead_id: 'missing', phone1: '+27831234567' },
    ],
    [{ leadId: 123, phone1: '0821234567' }],
  );
  expect(result.results.map((row: { status: string }) => row.status)).toEqual([
    'phone_candidates_review',
    'not_in_import',
  ]);
  expect(result.vendorRowsWithoutExactMatch).toEqual([0]);
});
it('flags duplicate vendor IDs rather than choosing an arbitrary match', () => {
  expect(
    reconcile([{ request_id: 'a', leadbyte_lead_id: '1' }], [{ leadId: 1 }, { leadId: 1 }])
      .results[0].status,
  ).toBe('ambiguous_id');
});
it('rejects malformed exports', () => {
  expect(() => reconcile([], [{ arbitrary: 'field' }])).toThrow();
});
