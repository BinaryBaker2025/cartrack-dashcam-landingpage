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
export function cleanName(value: unknown): string {
  return typeof value === 'string'
    ? cleanText(value.normalize('NFKC'), 162)
        .replace(/[\u2018\u2019\u02bc]/g, "'")
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*(['-])\s*/g, '$1')
        .trim()
    : '';
}
export function cleanPhone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 60) return '';
  const normalized = value.normalize('NFKC').trim();
  // Only remove presentation characters; never guess missing or extra digits.
  if (!/^[+\d\s().\u2010-\u2015-]+$/.test(normalized)) return '';
  let compact = normalized.replace(/[\s().\u2010-\u2015-]/g, '');
  if (compact.startsWith('0027')) compact = `+27${compact.slice(4)}`;
  if (compact.startsWith('+27')) compact = `+27${compact.slice(3).replace(/^0/, '')}`;
  else if (compact.startsWith('27')) compact = `+27${compact.slice(2).replace(/^0/, '')}`;
  else if (/^\d{9}$/.test(compact)) compact = `0${compact}`;
  const phone = parsePhoneNumberFromString(compact, 'ZA');
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
export function validateLead(
  raw: unknown,
  now = new Date(),
  options: { requireEmail?: boolean } = {},
) {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fullNameSupplied = r.name !== undefined;
  const fullName = cleanName(r.name);
  const nameParts = fullName.split(' ');
  // The compact form fills these values only after the visitor affirms all four facts.
  // Explicit answers remain authoritative, including a non-qualifying answer.
  const confirmed = r.eligibilityConfirmed === true;
  const eligibilityAnswersSupplied = ['age', 'vehicle', 'employment', 'income'].some(
    (field) => r[field] !== undefined,
  );
  const eligibilityConfirmationRequired = !confirmed && !eligibilityAnswersSupplied;
  const input: LeadInput = {
    firstname: fullNameSupplied ? (nameParts[0] ?? '') : cleanName(r.firstname),
    lastname: fullNameSupplied
      ? nameParts.slice(1).join(' ') || nameParts[0] || ''
      : cleanName(r.lastname) || cleanName(r.firstname),
    phone: cleanPhone(r.phone),
    ...(typeof r.email === 'string' && r.email.trim() ? { email: cleanText(r.email, 254) } : {}),
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
  if (eligibilityConfirmationRequired)
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
      const missingSurname =
        field === 'lastname' &&
        r.lastname === undefined &&
        validName.test(input.firstname) &&
        input.lastname === input.firstname;
      if (
        (typeof r[field] !== 'string' && !missingSurname) ||
        (typeof r[field] === 'string' && r[field].length > 80) ||
        !validName.test(input[field])
      )
        errors[field] =
          `Please enter your ${field === 'firstname' ? 'first' : 'last'} name using letters.`;
    }
  }
  if (!input.phone)
    errors.phone =
      'Please check your mobile number, for example 082 123 4567. Spaces and +27 are accepted.';
  const emailSupplied = typeof r.email === 'string' && !!r.email.trim();
  if (options.requireEmail && !emailSupplied) {
    errors.email = 'Please enter your email address.';
  } else if (
    r.email !== undefined &&
    (typeof r.email !== 'string' ||
      (!!r.email.trim() &&
        (r.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email || ''))))
  ) {
    errors.email = 'Please enter a valid email address.';
  }
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
  if (!eligibilityConfirmationRequired) {
    for (const [field, allowed, qualifying, reason, message] of checks) {
      if (!(allowed as readonly string[]).includes(input[field]))
        errors[field] = 'Please select an option.';
      else if (!(qualifying as readonly string[]).includes(input[field])) {
        errors[field] = message;
        reasons.push(reason);
      }
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
