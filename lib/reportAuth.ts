import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { privateReportResponse } from './reportResponse';

export const reportSessionCookie = 'owner_report_session';
export const reportSessionSeconds = 8 * 60 * 60;

const hash = (value: string) => createHash('sha256').update(value).digest();
const equal = (left: string, right: string) => timingSafeEqual(hash(left), hash(right));

export function validReportLogin(username: string, password: string, expected: string) {
  return equal(JSON.stringify([username, password]), JSON.stringify(['owner', expected]));
}

export function createReportSession(password: string, expires: number) {
  const signature = createHmac('sha256', password)
    .update(`owner-report-session:${expires}`)
    .digest('base64url');
  return `${expires}.${signature}`;
}

export function reportAccess(request: Request, password = process.env.REPORTING_PASSWORD) {
  if (
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
    return null;

  if (!password)
    return privateReportResponse(new Response('Reporting is not configured.', { status: 503 }));

  const session = request.headers
    .get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${reportSessionCookie}=`))
    ?.slice(reportSessionCookie.length + 1);
  const expires = Number(session?.split('.')[0]);
  if (session && expires > Date.now() && equal(session, createReportSession(password, expires)))
    return null;

  // Preserve existing API clients while browser requests use the sign-in page.
  if (new URL(request.url).pathname.startsWith('/api/reports')) {
    try {
      const authorization = request.headers.get('authorization') || '';
      if (
        authorization.startsWith('Basic ') &&
        equal(atob(authorization.slice(6)), `owner:${password}`)
      )
        return null;
    } catch {
      // Malformed credentials fail closed.
    }
  }

  return privateReportResponse(new Response('Owner sign-in required.', { status: 401 }));
}
