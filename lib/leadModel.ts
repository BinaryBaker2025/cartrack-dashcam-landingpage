import { validateLead, type LeadInput } from './validation';

export type LeadSource = 'WEBSITE' | 'GOOGLE_ADS' | 'MICROSOFT_ADS' | 'META_ADS' | 'TIKTOK_ADS';
export type LeadRequest = {
  source: LeadSource;
  externalLeadId: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adId?: string;
  formId?: string;
  contactConsent?: boolean | null;
  marketingConsent?: boolean | null;
  consentText?: string;
  consentVersion?: string;
  consentTimestamp?: string;
  consentSource?: string;
  submittedAt?: string;
  receivedAt: string;
  qualification?: Partial<Pick<LeadInput, 'age' | 'vehicle' | 'employment' | 'income'>>;
  preferredtimeofcall?: string;
  eligibilityConfirmed?: boolean;
  attribution?: unknown;
  metadata?: Record<string, unknown>;
  isTest?: boolean;
};

// Shared campaign rules; the provider parser never decides qualification.
export function assessLead(lead: LeadRequest) {
  const result = validateLead(
    {
      firstname: lead.firstname?.trim(),
      lastname: lead.lastname,
      phone: lead.phone,
      ...(lead.email !== undefined ? { email: lead.email.trim() } : {}),
      ...lead.qualification,
      ...(lead.eligibilityConfirmed !== undefined
        ? { eligibilityConfirmed: lead.eligibilityConfirmed }
        : {}),
      terms: lead.contactConsent === true,
      preferredtimeofcall: lead.preferredtimeofcall || '',
    },
    new Date(lead.receivedAt),
  );
  return {
    ...result,
    status: lead.isTest
      ? 'test'
      : result.valid && (lead.source === 'WEBSITE' || (lead.consentText && lead.consentVersion))
        ? 'pending'
        : result.reasons.length || lead.contactConsent === false
          ? 'rejected'
          : 'pending_review',
  };
}
