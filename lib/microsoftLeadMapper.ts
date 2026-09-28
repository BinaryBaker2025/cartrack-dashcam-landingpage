import type { LeadRequest } from './leadModel';
import { InvalidWebhookPayload } from './webhookPayload';

// This is BestCarDash's intermediary contract, not a native Microsoft schema.
export function microsoftLeadMapper(raw: Record<string, unknown>, now = new Date()): LeadRequest {
  const text = (key: string, limit = 256): string | undefined => {
    const value = raw[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string' || value.length > limit || !value.trim())
      throw new InvalidWebhookPayload('INVALID_FIELD');
    return value.trim();
  };
  const flag = (key: string): boolean | null => {
    const value = raw[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'boolean') throw new InvalidWebhookPayload('INVALID_BOOLEAN');
    return value;
  };
  const timestamp = (key: string) => {
    const value = text(key, 64);
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value)))
    )
      throw new InvalidWebhookPayload('INVALID_TIMESTAMP');
    return value ? new Date(value).toISOString() : undefined;
  };
  if (raw.source !== undefined && raw.source !== 'microsoft_ads' && raw.source !== 'MICROSOFT_ADS')
    throw new InvalidWebhookPayload('INVALID_SOURCE');
  const externalLeadId = text('externalLeadId');
  const fullName = text('fullName', 400);
  let firstname = text('firstName', 200);
  let lastname = text('lastName', 200);
  if (!firstname && !lastname && fullName) {
    const boundary = fullName.search(/\s/);
    firstname = boundary < 0 ? fullName : fullName.slice(0, boundary);
    lastname = boundary < 0 ? undefined : fullName.slice(boundary).trim();
  }
  const email = text('email', 320);
  const phone = text('phone', 64);
  if (!externalLeadId || !firstname || (!email && !phone))
    throw new InvalidWebhookPayload('MISSING_REQUIRED_FIELDS');
  const qualification: NonNullable<LeadRequest['qualification']> = {};
  if (raw.qualification !== undefined) {
    if (
      !raw.qualification ||
      typeof raw.qualification !== 'object' ||
      Array.isArray(raw.qualification)
    )
      throw new InvalidWebhookPayload('INVALID_QUALIFICATION');
    for (const key of ['age', 'vehicle', 'employment', 'income'] as const) {
      const value = (raw.qualification as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string' || value.length > 64)
        throw new InvalidWebhookPayload('INVALID_QUALIFICATION');
      qualification[key] = value.trim();
    }
  }
  return {
    source: 'MICROSOFT_ADS',
    externalLeadId,
    firstname,
    lastname,
    email,
    phone,
    campaignId: text('campaignId'),
    campaignName: text('campaignName'),
    adGroupId: text('adGroupId'),
    adId: text('adId'),
    formId: text('formId'),
    submittedAt: timestamp('submittedAt'),
    receivedAt: now.toISOString(),
    contactConsent: flag('contactConsent'),
    marketingConsent: flag('marketingConsent'),
    consentText: text('consentText', 8000),
    consentVersion: text('consentVersion'),
    consentTimestamp: timestamp('consentTimestamp'),
    consentSource: 'MICROSOFT_ADS',
    qualification,
    isTest: flag('isTest') === true,
    // Retain the exact original name, including whitespace, independently of derived names.
    metadata: { fullName: raw.fullName, deliveryMethod: 'intermediary' },
  };
}
