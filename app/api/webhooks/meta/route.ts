import { after } from 'next/server';
import { leadBindings } from '@/lib/leadBindings';
import { metaChallenge, receiveSocialWebhook, socialReply } from '@/lib/socialWebhooks';
import { processSocialInbox } from '@/lib/socialLeadProcessor';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    return metaChallenge(request, await leadBindings());
  } catch {
    return socialReply(503);
  }
}
export async function POST(request: Request) {
  try {
    const env = await leadBindings();
    const response = await receiveSocialWebhook(request, env, 'META_ADS');
    if (response.ok) after(() => processSocialInbox(env));
    return response;
  } catch {
    return socialReply(503);
  }
}
