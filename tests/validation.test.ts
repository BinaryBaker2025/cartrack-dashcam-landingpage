import { describe, expect, it } from 'vitest';
import { validateLead, cleanPhone, parseCallTime } from '../lib/validation';
import { captureAttribution } from '../lib/attribution';
// Synthetic fixture only: mocked tests never contact this number or the live API.
import { valid } from './fixtures';
describe('qualification', () => {
  it('fills the four confirmed eligibility fields without inventing an income bracket', () => {
    const result = validateLead({
      ...valid,
      age: undefined,
      vehicle: undefined,
      employment: undefined,
      income: undefined,
      eligibilityConfirmed: true,
    });
    expect(result.valid).toBe(true);
    expect(result.input).toMatchObject({
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      eligibilityConfirmed: true,
    });
  });
  it.each([false, undefined, 'true'])(
    'does not fill eligibility without boolean confirmation: %s',
    (eligibilityConfirmed) => {
      const result = validateLead({
        ...valid,
        age: undefined,
        vehicle: undefined,
        employment: undefined,
        income: undefined,
        eligibilityConfirmed,
      });
      expect(result.valid).toBe(false);
      expect(result.input.age).toBe('');
      expect(Object.keys(result.errors)).toEqual(['eligibilityConfirmed']);
    },
  );
  it('does not override a non-qualifying answer even when confirmation is checked', () => {
    const result = validateLead({ ...valid, age: 'under_18', eligibilityConfirmed: true });
    expect(result.valid).toBe(false);
    expect(result.input.age).toBe('under_18');
  });
  it('accepts a qualifying lead', () => expect(validateLead(valid).valid).toBe(true));
  it.each([
    ['age', 'under_18', 'does_not_qualify_age'],
    ['vehicle', 'no', 'does_not_have_vehicle'],
    ['employment', 'unemployed', 'does_not_qualify_employment'],
    ['income', 'under_10000', 'does_not_qualify_income'],
  ])('rejects %s=%s locally', (key, value, reason) => {
    const r = validateLead({ ...valid, [key]: value });
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain(reason);
  });
  it('requires consent', () =>
    expect(validateLead({ ...valid, terms: false }).errors.terms).toBeTruthy());
  it.each(['123', '+442071234567', '0211234567', '0821234567 ext 12'])(
    'rejects invalid/mobile-ineligible ZA phone %s',
    (phone) => expect(validateLead({ ...valid, phone }).valid).toBe(false),
  );
  it('normalises ZA national mobile', () =>
    expect(cleanPhone('082 123 4567')).toBe('+27821234567'));
  it.each([
    '0821234567',
    '082 123 4567',
    '082-123-4567',
    '821234567',
    '+27821234567',
    '+27 082 123 4567',
    '27821234567',
    '27 082 123 4567',
    '0027 (0)82 123 4567',
    '082.123.4567',
    '\uff10\uff18\uff12\uff11\uff12\uff13\uff14\uff15\uff16\uff17',
    '082\u2013123\u20134567',
  ])('normalises common South African mobile formats: %s', (phone) => {
    expect(cleanPhone(phone)).toBe('+27821234567');
  });
  it('rejects unknown qualifying selections', () =>
    expect(validateLead({ ...valid, age: 'yes', income: '50000' }).valid).toBe(false));
  it('requires alphabetic names', () =>
    expect(validateLead({ ...valid, firstname: 'Test123' }).valid).toBe(false));
  it('supports accented multi-part names', () =>
    expect(validateLead({ ...valid, firstname: 'Tést', lastname: 'O’Testing' }).valid).toBe(true));
  it.each([
    ['Test Testing', 'Test', 'Testing'],
    ['  J.   Testing  ', 'J', 'Testing'],
    ['Test O\u2019 Testing', 'Test', "O'Testing"],
    ['Test Anne \u2013 Marie', 'Test', 'Anne-Marie'],
    ['Test van der Testing', 'Test', 'van der Testing'],
    ['Mononym', 'Mononym', ''],
  ])(
    'accepts a single full name and maps it to the lead fields: %s',
    (name, firstname, lastname) => {
      const result = validateLead({ ...valid, name });
      expect(result.valid).toBe(true);
      expect(result.input).toMatchObject({ firstname, lastname });
    },
  );
  it('rejects invalid full names', () => {
    const result = validateLead({ ...valid, name: 'Test123 Person' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });
  it('rejects a rolled-over call date', () => expect(parseCallTime('2027-02-31T12:00')).toBeNull());
  it('rejects past preferred call times', () =>
    expect(validateLead({ ...valid, preferredtimeofcall: '2020-01-01T09:00' }).valid).toBe(false));
});
describe('attribution', () => {
  it('captures transaction_id', () =>
    expect(captureAttribution('?transaction_id=abc').transaction_id).toBe('abc'));
  it('preserves campaign parameters across navigation', () =>
    expect(captureAttribution('', { transaction_id: 'abc', utm_source: 'source' })).toEqual({
      transaction_id: 'abc',
      utm_source: 'source',
    }));
  it('captures an untrusted incoming offer only as attribution', () =>
    expect(captureAttribution('?offer_id=999').offer_id).toBe('999'));
  it('supports aff_id links and limits keys', () =>
    expect(captureAttribution('?aff_id=27144&phone=secret')).toEqual({ affiliate_id: '27144' }));
});
