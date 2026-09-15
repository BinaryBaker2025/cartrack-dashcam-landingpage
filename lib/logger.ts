import { createHmac, randomBytes } from 'node:crypto';
import { ConfigurationError } from './diagnostics';
const instanceSalt = randomBytes(32);
export function digest(value: string) {
  const secret = process.env.LEAD_HASH_SECRET;
  if (process.env.NODE_ENV !== 'test' && (!secret || secret.length < 32))
    throw new ConfigurationError('CONFIG_HASH_SECRET_REQUIRED');
  return createHmac('sha256', secret || instanceSalt)
    .update(value)
    .digest('hex');
}
export function maskPhone(phone: string) {
  return phone ? `${phone.slice(0, 3)}******${phone.slice(-3)}` : '';
}
export function redactResponse(response: string | undefined, sensitive: string[] = []) {
  let result = (response || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  for (const value of sensitive.filter(Boolean).sort((a, b) => b.length - a.length))
    result = result.split(value).join('[redacted]');
  return result
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[redacted-number]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .slice(0, 500);
}
export function log(
  event: string,
  data: {
    id?: string;
    code?: number;
    response?: string;
    reasons?: string[];
    diagnosticCode?: string;
    upstreamStatus?: number;
    fetchError?: string;
  } = {},
) {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
}
