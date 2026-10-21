import { database } from '@/lib/database';
import { reportAccess } from '@/lib/reportAuth';
import { readReport, reportFilters } from '@/lib/reporting';

export async function GET(request: Request) {
  const denied = reportAccess(request);
  if (denied) return denied;
  let filters;
  try {
    filters = reportFilters(new URL(request.url));
  } catch {
    return Response.json(
      { error: 'Choose a valid date range of up to 366 days.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    return Response.json(
      await readReport(
        await database(),
        filters,
        new URL(request.url).searchParams.get('export') === 'all',
      ),
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          Vary: 'Authorization',
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Reporting is unavailable. Check the database binding and migrations.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
