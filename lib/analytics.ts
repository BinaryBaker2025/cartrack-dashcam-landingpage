export type AnalyticsEvent =
  | 'landing_page_view'
  | 'form_started'
  | 'qualification_failed'
  | 'form_validation_failed'
  | 'lead_submit_started'
  | 'lead_submit_success'
  | 'lead_submit_rejected'
  | 'lead_submit_error';
export type AnalyticsProperties = { reasons?: string[]; fields?: string[]; state?: string };
type Adapter = (event: AnalyticsEvent, properties: AnalyticsProperties) => void;
let adapter: Adapter | undefined;
export function configureAnalytics(next: Adapter) {
  adapter = next;
}
export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  // Intentionally no PII, attribution identifiers, network request or provider by default.
  try {
    adapter?.(event, properties);
  } catch {
    /* Analytics must never interrupt a lead. */
  }
}
