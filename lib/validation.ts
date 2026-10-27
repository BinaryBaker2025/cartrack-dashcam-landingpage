import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const employmentOptions = ['employed', 'self_employed'] as const;
export type LeadInput = {
  firstname: string;
  lastname: string;
  phone: string;
  email?: string;
  eligibilityConfirmed?: boolean;
  age: string;
  vehicle: string;
  employment: string;
  income: string;
  terms: boolean;
  preferredtimeofcall: string;
  website: string;
};
export type FieldErrors = Partial<Record<keyof LeadInput | 'name', string>>;
export function cleanText(value: unknown, max = 80): string {
  return typeof value === 'string'
    ? value
        .normalize('NFC')
        .replace(/[<>\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, max)
    : '';
}
export function cleanPhone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 30 || !/^[+\d\s()-]+$/.test(value)) return '';
  const phone = parsePhoneNumberFromString(value.trim(), 'ZA');
  return phone?.country === 'ZA' && phone.isValid() && phone.getType() === 'MOBILE'
    ? phone.number
    : '';
}
export function parseCallTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+02:00`);
  if (!Number.isFinite(date.getTime())) return null;
  // Reject JS date rollover (for example 31 February).
  return new Date(date.getTime() + 7200000).toISOString().slice(0, 16) === value ? date : null;
}
export function validateLead(raw: unknown, now = new Date()) {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fullNameSupplied = r.name !== undefined;
  const fullName =
    typeof r.name === 'string' ? cleanText(r.name, 161).replace(/\s+/g, ' ') : '';
  const nameParts = fullName.split(' ');
  // The compact form fills these values only after the visitor affirms all four facts.
  // Explicit answers remain authoritative, including a non-qualifying answer.
  const confirmed = r.eligibilityConfirmed === true;
  const input: LeadInput = {
    firstname: fullNameSupplied ? (nameParts[0] ?? '') : cleanText(r.firstname),
    lastname: fullNameSupplied ? nameParts.slice(1).join(' ') : cleanText(r.lastname),
    phone: cleanPhone(r.phone),
    ...(r.email !== undefined ? { email: cleanText(r.email, 254) } : {}),
    ...(r.eligibilityConfirmed !== undefined ? { eligibilityConfirmed: confirmed } : {}),
    age: cleanText(r.age ?? (confirmed ? '18_plus' : '')),
    vehicle: cleanText(r.vehicle ?? (confirmed ? 'yes' : '')),
    employment: cleanText(r.employment ?? (confirmed ? 'employed' : '')),
    income: cleanText(r.income ?? (confirmed ? '10000_plus' : '')),
    terms: r.terms === true,
    preferredtimeofcall: cleanText(r.preferredtimeofcall, 30),
    website: cleanText(r.website),
  };
  const errors: FieldErrors = {};
  const reasons: string[] = [];
  if (r.eligibilityConfirmed !== undefined && !confirmed)
    errors.eligibilityConfirmed = 'Please confirm that you meet all four requirements.';
  const validName = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
  if (fullNameSupplied) {
    if (
      typeof r.name !== 'string' ||
      r.name.length > 161 ||
      !validName.test(fullName) ||
      input.firstname.length > 80 ||
      input.lastname.length > 80
    )
      errors.name = 'Please enter your name using letters.';
  } else {
    for (const field of ['firstname', 'lastname'] as const) {
      // Letters, combining accents and separators support real multi-part names.
      if (
        typeof r[field] !== 'string' ||
        r[field].length > 80 ||
        !validName.test(input[field])
      )
        errors[field] =
          `Please enter your ${field === 'firstname' ? 'first' : 'last'} name using letters.`;
    }
  }
  if (!input.phone) errors.phone = 'Please enter a valid South African mobile number.';
  // Legacy API clients may still provide email; the quote form does not collect it.
  if (
    r.email !== undefined &&
    (typeof r.email !== 'string' ||
      r.email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email || ''))
  )
    errors.email = 'Please enter a valid email address.';
  const checks = [
    [
      'age',
      ['18_plus', 'under_18'],
      ['18_plus'],
      'does_not_qualify_age',
      'You must be 18 or older for this offer.',
    ],
    [
      'vehicle',
      ['yes', 'no'],
      ['yes'],
      'does_not_have_vehicle',
      'This offer requires access to a vehicle.',
    ],
    [
      'employment',
      ['employed', 'self_employed', 'unemployed', 'retired', 'student'],
      ['employed', 'self_employed'],
      'does_not_qualify_employment',
      'This offer requires you to be employed or self-employed.',
    ],
    [
      'income',
      ['under_10000', '10000_plus', '10000_19999', '20000_39999', '40000_plus'],
      ['10000_plus', '10000_19999', '20000_39999', '40000_plus'],
      'does_not_qualify_income',
      'This offer requires a monthly income of R10,000 or more.',
    ],
  ] as const;
  for (const [field, allowed, qualifying, reason, message] of checks) {
    if (!(allowed as readonly string[]).includes(input[field]))
      errors[field] = 'Please select an option.';
    else if (!(qualifying as readonly string[]).includes(input[field])) {
      errors[field] = message;
      reasons.push(reason);
    }
  }
  if (!input.terms) errors.terms = 'Please accept the terms and consent to being contacted.';
  if (input.preferredtimeofcall) {
    const date = parseCallTime(input.preferredtimeofcall);
    if (!date || date <= now || date.getTime() > now.getTime() + 30 * 86400000)
      errors.preferredtimeofcall = 'Choose a future time within 30 days (South African time).';
  }
  return { input, errors, reasons, valid: Object.keys(errors).length === 0 };
}
