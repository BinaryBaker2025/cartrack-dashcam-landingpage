import type { LeadResult } from './leadbyte';
import { TemporaryStore } from './temporaryStore';
type Entry = { fingerprint: string; result?: string; httpStatus?: number };
const submissions = new TemporaryStore<Entry>();
const lifetime = 30 * 60 * 1000;
export async function claimSubmission(key: string, fingerprint: string) {
  const existing = submissions.get(key);
  if (existing) return { claimed: false as const, existing };
  // No await between lookup and insertion: atomic within this JS instance only.
  if (!submissions.set(key, { fingerprint }, Date.now() + lifetime))
    throw new Error('Submission capacity reached');
  return { claimed: true as const };
}
export async function completeSubmission(
  key: string,
  result: Pick<LeadResult, 'state' | 'message'> & { retryable?: boolean },
  status: number,
) {
  const entry = submissions.get(key);
  if (entry) {
    entry.result = JSON.stringify(result);
    entry.httpStatus = status;
  }
}
