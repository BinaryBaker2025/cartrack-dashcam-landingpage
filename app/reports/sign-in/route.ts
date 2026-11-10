import {
  createReportSession,
  reportSessionCookie,
  reportSessionSeconds,
  validReportLogin,
} from '@/lib/reportAuth';
import { rateLimit } from '@/lib/rateLimit';
import { privateReportResponse } from '@/lib/reportResponse';

function signIn(message = '', status = 200) {
  return privateReportResponse(
    new Response(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Owner sign-in | Best Car Dash</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f6f8; color: #142133; font: 1rem system-ui, sans-serif; }
  main { box-sizing: border-box; width: min(28rem, calc(100% - 2rem)); padding: 2rem; border: 1px solid #d9e0e8; border-radius: 1rem; background: white; }
  h1 { margin: 0 0 1.5rem; }
  form, label { display: grid; gap: .5rem; }
  form { gap: 1rem; }
  input, button { padding: .75rem; border-radius: .4rem; font: inherit; }
  input { width: 100%; box-sizing: border-box; border: 1px solid #697788; }
  button { border: 0; background: #142133; color: white; cursor: pointer; }
  [role=alert] { color: #9a241e; }
</style>
</head>
<body><main>
<p>Best Car Dash · Owner reports</p>
<h1>Sign in</h1>
${message ? `<p role="alert">${message}</p>` : ''}
<form method="post" action="/reports/sign-in">
<label>Username <input name="username" autocomplete="username" required></label>
<label>Password <input name="password" type="password" autocomplete="current-password" required></label>
<button type="submit">Sign in</button>
</form>
</main></body>
</html>`,
      { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    ),
  );
}

export function GET() {
  return signIn();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return signIn('Invalid sign-in request.', 403);

  const expected = process.env.REPORTING_PASSWORD;
  if (!expected) return signIn('Reporting is unavailable.', 503);

  const limit = await rateLimit(request, 'report-login').catch(() => null);
  if (!limit) return signIn('Reporting is unavailable. Try again later.', 503);
  if (!limit.allowed) return signIn('Too many attempts. Try again later.', 429);

  const form = await request.formData().catch(() => null);
  const username = form?.get('username');
  const password = form?.get('password');
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !validReportLogin(username, password, expected)
  )
    return signIn('Incorrect username or password.', 401);

  const session = createReportSession(expected, Date.now() + reportSessionSeconds * 1000);
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return privateReportResponse(
    new Response(null, {
      status: 303,
      headers: {
        Location: '/reports',
        'Set-Cookie': `${reportSessionCookie}=${session}; Path=/; Max-Age=${reportSessionSeconds}; HttpOnly; SameSite=Lax${secure}`,
      },
    }),
  );
}
