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
  field: 'name' | 'mobile' | 'eligibility' | 'consent' | 'honeypot';
  reason: 'format' | 'required' | 'filled';
};
export type AnalyticsProperties = { failures?: ValidationFailure[]; state?: string };
type Adapter = (event: AnalyticsEvent, properties: AnalyticsProperties) => void;
let adapter: Adapter | undefined;
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
