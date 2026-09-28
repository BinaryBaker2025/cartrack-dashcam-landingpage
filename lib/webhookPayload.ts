export class InvalidWebhookPayload extends Error {}

export function sanitizePayload(value: unknown, secret: string): unknown {
  if (typeof value === 'string') return value.split(secret).join('[redacted]');
  if (Array.isArray(value)) return value.map((entry) => sanitizePayload(entry, secret));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /key|token|secret|authorization|password/i.test(key)
          ? '[redacted]'
          : sanitizePayload(item, secret),
      ]),
    );
  return value;
}

export async function readJsonBody(
  request: Request,
  limit = 65536,
): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidWebhookPayload('EMPTY_BODY');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new InvalidWebhookPayload('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  // V8's JSON source context preserves Google's 64-bit numeric IDs without
  // rounding them through a JavaScript number. Fail closed on older runtimes.
  const data: unknown = JSON.parse(
    Buffer.concat(chunks).toString('utf8'),
    (key: string, value: unknown, context?: { source?: string }) => {
      if (
        typeof value === 'number' &&
        /^(lead_id|form_id|campaign_id|adgroup_id|creative_id|asset_group_id)$/.test(key)
      ) {
        if (context?.source && /^\d+$/.test(context.source)) return context.source;
        if (!Number.isSafeInteger(value)) throw new InvalidWebhookPayload('UNSAFE_IDENTIFIER');
      }
      return value;
    },
  );
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new InvalidWebhookPayload('INVALID_JSON');
  return data as Record<string, unknown>;
}
