// Persist only a digest and random id, never contact details, in browser session storage.
export async function submissionKey(payload: string, renew = false) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = `cartrack-submit-${hash}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (!renew && existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  } catch {
    /* The form ref still protects visitors whose storage is disabled. */
  }
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* Memory fallback in the form. */
  }
  return id;
}
