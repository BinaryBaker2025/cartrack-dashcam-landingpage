import { leadBindings } from '@/lib/leadBindings';
import { microsoftWebhook } from '@/lib/microsoftWebhook';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await microsoftWebhook(request, await leadBindings());
  } catch {
    return Response.json(
      { message: 'Service unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
