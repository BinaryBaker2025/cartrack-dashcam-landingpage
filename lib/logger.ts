import { createHmac, randomBytes } from 'node:crypto';
const instanceSalt = randomBytes(32);
export function digest(value: string) {
  return createHmac('sha256', instanceSalt).update(value).digest('hex');
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
  } = {},
) {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
}
