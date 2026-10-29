// Persist only a digest and random id, never contact details, in browser session storage.
const memoryKeys = new Map<string, string>();

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function submissionKey(payload: string, renew = false) {
  if (!renew && memoryKeys.has(payload)) return memoryKeys.get(payload)!;
  let bytes: ArrayBuffer;
  try {
    bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  } catch {
    // Older browsers and insecure contexts may not expose SubtleCrypto.
    // Keep retry identity in memory without persisting the contact details.
    const id = randomId();
    memoryKeys.set(payload, id);
    return id;
  }
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = `cartrack-submit-${hash}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (!renew && existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  } catch {
    /* The form ref still protects visitors whose storage is disabled. */
  }
  const id = randomId();
  memoryKeys.set(payload, id);
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* Memory fallback in the form. */
  }
  return id;
}
