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

export async function readRawBody(request: Request, limit = 65536): Promise<Buffer> {
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
  return Buffer.concat(chunks);
}

export function parseWebhookJson(body: string): Record<string, unknown> {
  // V8's JSON source context preserves providers' 64-bit numeric IDs without
  // rounding them through a JavaScript number. Fail closed on older runtimes.
  const data: unknown = JSON.parse(
    body,
    (key: string, value: unknown, context?: { source?: string }) => {
      if (
        typeof value === 'number' &&
        /^(id|leadgen_id|lead_id|page_id|advertiser_id|library_id|form_id|campaign_id|ad_id|adgroup_id|creative_id|asset_group_id)$/.test(
          key,
        )
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

export async function readJsonBody(request: Request, limit = 65536) {
  return parseWebhookJson((await readRawBody(request, limit)).toString('utf8'));
}
