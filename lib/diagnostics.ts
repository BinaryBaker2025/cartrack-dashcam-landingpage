export class ConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ConfigurationError';
  }
}
export type Diagnostics = {
  code: string;
  requestId?: string;
  leadByteCode?: number;
  upstreamStatus?: number;
};
// Only allowlisted scalars go to the console, never the response body or contact fields.
export function reportDiagnostic(raw: unknown, httpStatus?: number) {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const safe: Record<string, string | number> = {
    code:
      typeof d.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(d.code)
        ? d.code
        : 'API_UNEXPECTED_RESPONSE',
  };
  if (typeof d.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(d.requestId))
    safe.requestId = d.requestId;
  if (typeof d.leadByteCode === 'number' && Number.isInteger(d.leadByteCode))
    safe.leadByteCode = d.leadByteCode;
  if (typeof d.upstreamStatus === 'number') safe.upstreamStatus = d.upstreamStatus;
  if (httpStatus !== undefined) safe.httpStatus = httpStatus;
  console.info('[CarTrack lead diagnostic]', safe);
}
