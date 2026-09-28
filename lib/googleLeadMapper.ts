import type { LeadRequest } from './leadModel';

type AnswerMapping = { columnId: string; values: Record<string, string | boolean> };
export type GoogleFormMapping = {
  fields?: Partial<Record<'firstname' | 'lastname' | 'email' | 'phone', string>>;
  answers?: Partial<
    Record<
      'age' | 'vehicle' | 'employment' | 'income' | 'contactConsent' | 'marketingConsent',
      AnswerMapping
    >
  >;
  consentText?: string;
  consentVersion?: string;
};
export type GoogleMappings = Record<string, GoogleFormMapping>;
export class InvalidGooglePayload extends Error {}

function identifier(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0 && value.length <= 256) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (value !== undefined) throw new InvalidGooglePayload('INVALID_IDENTIFIER');
}

export function googleLeadMapper(
  raw: Record<string, unknown>,
  mappings: GoogleMappings = {},
  now = new Date(),
): LeadRequest {
  const externalLeadId = identifier(raw.lead_id);
  if (!externalLeadId || !Array.isArray(raw.user_column_data) || raw.user_column_data.length > 100)
    throw new InvalidGooglePayload('INVALID_LEAD');
  if (raw.is_test !== undefined && typeof raw.is_test !== 'boolean')
    throw new InvalidGooglePayload('INVALID_TEST_FLAG');
  const columns = new Map<string, string>();
  for (const entry of raw.user_column_data) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.column_id !== 'string' ||
      typeof entry.string_value !== 'string' ||
      entry.string_value.length > 4000 ||
      columns.has(entry.column_id)
    )
      throw new InvalidGooglePayload('INVALID_FIELDS');
    columns.set(entry.column_id, entry.string_value);
  }
  const formId = identifier(raw.form_id);
  const mapping = formId && Object.hasOwn(mappings, formId) ? mappings[formId] : {};
  const field = (key: keyof NonNullable<GoogleFormMapping['fields']>, fallback: string) =>
    columns.get(mapping.fields?.[key] || fallback);
  const answer = (key: keyof NonNullable<GoogleFormMapping['answers']>) => {
    const config = mapping.answers?.[key];
    const value = config ? columns.get(config.columnId)?.trim() : undefined;
    return config && value !== undefined && Object.hasOwn(config.values, value)
      ? config.values[value]
      : undefined;
  };
  let firstname = field('firstname', 'FIRST_NAME');
  let lastname = field('lastname', 'LAST_NAME');
  const fullName = columns.get('FULL_NAME')?.trim();
  // Preserve the entire remaining surname; a mononym stays incomplete for review.
  if (!firstname && !lastname && fullName) {
    const boundary = fullName.search(/\s/);
    firstname = boundary < 0 ? fullName : fullName.slice(0, boundary);
    lastname = boundary < 0 ? undefined : fullName.slice(boundary).trim();
  }
  const submittedAt =
    typeof raw.lead_submit_time === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.lead_submit_time) &&
    Number.isFinite(Date.parse(raw.lead_submit_time))
      ? new Date(raw.lead_submit_time).toISOString()
      : undefined;
  const contact = answer('contactConsent');
  const marketing = answer('marketingConsent');
  const qualification: NonNullable<LeadRequest['qualification']> = {};
  for (const key of ['age', 'vehicle', 'employment', 'income'] as const) {
    const value = answer(key);
    if (typeof value === 'string') qualification[key] = value;
  }
  return {
    source: 'GOOGLE_ADS',
    externalLeadId,
    firstname,
    lastname,
    email: field('email', 'EMAIL'),
    phone: field('phone', 'PHONE_NUMBER'),
    campaignId: identifier(raw.campaign_id),
    formId,
    adGroupId: identifier(raw.adgroup_id),
    adId: identifier(raw.creative_id),
    contactConsent: typeof contact === 'boolean' ? contact : null,
    marketingConsent: typeof marketing === 'boolean' ? marketing : null,
    consentText: mapping.consentText,
    consentVersion: mapping.consentVersion,
    consentTimestamp:
      typeof contact === 'boolean' || typeof marketing === 'boolean' ? submittedAt : undefined,
    consentSource: 'GOOGLE_ADS',
    submittedAt,
    receivedAt: now.toISOString(),
    qualification,
    isTest: raw.is_test === true,
    metadata: {
      fullName,
      gclId: raw.gcl_id,
      assetGroupId: identifier(raw.asset_group_id),
      leadStage: raw.lead_stage,
      leadSource: raw.lead_source,
    },
  };
}
