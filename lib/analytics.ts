export type AnalyticsEvent =
  | 'landing_page_view'
  | 'form_started'
  | 'qualification_failed'
  | 'form_validation_failed'
  | 'lead_submit_started'
  | 'lead_submit_success'
  | 'lead_submit_rejected'
  | 'lead_submit_error';
export type ValidationFailure = {
  field: 'name' | 'mobile' | 'email' | 'eligibility' | 'consent' | 'honeypot';
  reason:
    | 'format'
    | 'required'
    | 'filled'
    | 'too_long'
    | 'country_code'
    | 'contains_letters'
    | 'missing_at'
    | 'missing_domain';
};
export type AnalyticsProperties = { failures?: ValidationFailure[]; state?: string };
type Adapter = (event: AnalyticsEvent, properties: AnalyticsProperties) => void;
let adapter: Adapter | undefined;

const validationReasons: Record<ValidationFailure['field'], readonly string[]> = {
  name: ['format', 'required', 'too_long'],
  mobile: ['format', 'required', 'too_long', 'country_code', 'contains_letters'],
  email: ['format', 'required', 'too_long', 'missing_at', 'missing_domain'],
  eligibility: ['required'],
  consent: ['required'],
  honeypot: ['filled'],
};

const validationFieldByInput: Record<string, ValidationFailure['field'] | undefined> = {
  name: 'name',
  firstname: 'name',
  lastname: 'name',
  phone: 'mobile',
  email: 'email',
  eligibilityConfirmed: 'eligibility',
  terms: 'consent',
};

export function parseValidationFailures(value: unknown): ValidationFailure[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const failures: ValidationFailure[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { field, reason } = item as { field?: unknown; reason?: unknown };
    if (typeof field !== 'string' || !Object.hasOwn(validationReasons, field)) return null;
    const failureField = field as ValidationFailure['field'];
    if (typeof reason !== 'string' || !validationReasons[failureField].includes(reason))
      return null;
    failures.push({ field: failureField, reason: reason as ValidationFailure['reason'] });
  }
  return failures;
}

export function validationFailuresFromErrors(
  errors: Readonly<Record<string, unknown>>,
  reasons: Readonly<Record<string, unknown>>,
): ValidationFailure[] {
  const failures: { field: string; reason: unknown }[] = [];
  const seen = new Set<ValidationFailure['field']>();
  for (const inputField of Object.keys(errors)) {
    const field = validationFieldByInput[inputField];
    if (!field || seen.has(field)) continue;
    seen.add(field);
    failures.push({ field, reason: reasons[inputField] });
  }
  return parseValidationFailures(failures) ?? [];
}

export function configureAnalytics(next: Adapter) {
  adapter = next;
}
export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  try {
    if (typeof window !== 'undefined') {
      void fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          ...(event === 'form_validation_failed' && properties.failures
            ? { failures: properties.failures }
            : {}),
        }),
        keepalive: true,
      }).catch(() => {});
    }
    adapter?.(event, properties);
  } catch {
    /* Analytics must never interrupt a lead. */
  }
}
