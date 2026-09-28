import { leadBindings } from '@/lib/leadBindings';
import { googleWebhook } from '@/lib/googleWebhook';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await googleWebhook(request, await leadBindings());
  } catch {
    return Response.json(
      { message: 'Service unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
