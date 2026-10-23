import { createHash, timingSafeEqual } from 'node:crypto';

export function reportAccess(request: Request, password = process.env.REPORTING_PASSWORD) {
  // next dev does not run the production Worker's page-level sign-in gate.
  // Limit password-free development access to loopback hosts only.
  if (
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
    return null;
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    Vary: 'Authorization',
  };
  if (!password || password.length < 24)
    return new Response('Reporting is not configured.', { status: 503, headers });
  let credentials = '';
  try {
    const authorization = request.headers.get('authorization') || '';
    if (authorization.startsWith('Basic ')) credentials = atob(authorization.slice(6));
  } catch {
    /* Invalid credentials fail closed. */
  }
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(hash(credentials), hash(`owner:${password}`))) {
    return new Response('Owner sign-in required.', {
      status: 401,
      headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Owner reports", charset="UTF-8"' },
    });
  }
  return null;
}
