import type { Attribution } from './attribution';
const WINDOW = 10 * 60 * 1000;
const TTL = 30 * 60 * 1000;
const KEY = 'cartrack-temporary-state';
type Receipt = {
  state: 'success' | 'duplicate';
  message: string;
  createdAt: number;
  attribution: Attribution;
};
type State = { attempts: number[]; receipts: Record<string, Receipt> };
let memory: State = { attempts: [], receipts: {} };
function read(now: number): State {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      parsed &&
      Array.isArray(parsed.attempts) &&
      parsed.receipts &&
      typeof parsed.receipts === 'object'
    )
      memory = parsed;
  } catch {
    /* Disabled or corrupt storage uses the memory fallback. */
  }
  memory.attempts = memory.attempts.filter(
    (t) => typeof t === 'number' && t <= now && t > now - WINDOW,
  );
  memory.receipts = Object.fromEntries(
    Object.entries(memory.receipts).filter(
      ([, r]) =>
        r &&
        (r.state === 'success' || r.state === 'duplicate') &&
        typeof r.message === 'string' &&
        r.createdAt <= now &&
        r.createdAt > now - TTL,
    ),
  );
  return memory;
}
function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* In-memory fallback. */
  }
}
export function browserAttempt(now = Date.now()) {
  const state = read(now);
  if (state.attempts.length >= 5)
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((state.attempts[0] + WINDOW - now) / 1000)),
    };
  state.attempts.push(now);
  save();
  return { allowed: true, retryAfter: 0 };
}
export function browserReceipt(id: string, now = Date.now()) {
  const value = read(now).receipts[id];
  save();
  return value;
}
export function saveBrowserReceipt(
  id: string,
  result: Pick<Receipt, 'state' | 'message'>,
  attribution: Attribution,
  now = Date.now(),
) {
  const state = read(now);
  state.receipts[id] = { ...result, createdAt: now, attribution };
  // Bound storage even if a session remains open for a long time.
  state.receipts = Object.fromEntries(Object.entries(state.receipts).slice(-20));
  save();
}
