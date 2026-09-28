import { createHmac, randomUUID } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { googleLeadMapper, type GoogleMappings } from './googleLeadMapper';
import { ingestLead } from './leadService';
import { identifier, object, socialEntries, type SocialProvider } from './socialWebhooks';
import { parseWebhookJson } from './webhookPayload';
import { siteUrl } from './config';

type InboxRow = {
  id: string;
  provider: SocialProvider;
  payload_json: string;
  attempts: number;
  cursor: number;
};
function timestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e11)
    return new Date(value * 1000).toISOString();
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toISOString();
}
export async function processSocialPayload(row: InboxRow, env: LeadBindings, fetcher = fetch) {
  const raw = parseWebhookJson(row.payload_json);
  const mappings = object(
    JSON.parse(
      (row.provider === 'META_ADS' ? env.META_FORM_MAPPINGS : env.TIKTOK_FORM_MAPPINGS) || '{}',
    ),
  ) as GoogleMappings;
  for (const mapping of Object.values(mappings)) {
    object(mapping);
    if (
      mapping.fields &&
      Object.values(object(mapping.fields)).some((value) => typeof value !== 'string')
    )
      throw new Error('INVALID_MAPPING');
    for (const answer of Object.values(mapping.answers || {})) {
      object(answer);
      if (
        typeof answer.columnId !== 'string' ||
        Object.values(object(answer.values)).some(
          (value) => typeof value !== 'string' && typeof value !== 'boolean',
        )
      )
        throw new Error('INVALID_MAPPING');
    }
    if (
      (mapping.consentText !== undefined && typeof mapping.consentText !== 'string') ||
      (mapping.consentVersion !== undefined && typeof mapping.consentVersion !== 'string')
    )
      throw new Error('INVALID_MAPPING');
  }
  let position = 0;
  let processed = 0;
  for (const entry of socialEntries(raw, row.provider, env)) {
    const records =
      row.provider === 'META_ADS'
        ? (entry.changes as unknown[])
            .map(object)
            .filter((change) => change.field === 'leadgen')
            .map((change) => object(change.value))
        : [entry];
    for (const record of records) {
      if (position++ < row.cursor) continue;
      if (processed >= 5) return false;
      const id = identifier(row.provider === 'META_ADS' ? record.leadgen_id : record.id);
      const formId = identifier(row.provider === 'META_ADS' ? record.form_id : record.page_id);
      let details = record;
      if (row.provider === 'META_ADS') {
        if (!env.META_PAGE_ACCESS_TOKEN || !/^v\d+\.0$/.test(env.META_GRAPH_VERSION || ''))
          throw new Error('META_CONFIGURATION_REQUIRED');
        const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${id}`);
        url.searchParams.set(
          'fields',
          'id,created_time,field_data,form_id,ad_id,adset_id,campaign_id',
        );
        if (env.META_APP_SECRET)
          url.searchParams.set(
            'appsecret_proof',
            createHmac('sha256', env.META_APP_SECRET)
              .update(env.META_PAGE_ACCESS_TOKEN)
              .digest('hex'),
          );
        const response = await fetcher(url, {
          headers: { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
        details = object(await response.json());
        if (details.id !== id || details.form_id !== formId)
          throw new Error('PROVIDER_ID_MISMATCH');
      }
      const fields = row.provider === 'META_ADS' ? details.field_data : details.changes;
      if (!Array.isArray(fields) || fields.length > 100) throw new Error('INVALID_FIELDS');
      const columns = fields.flatMap((value) => {
        const field = object(value);
        const key = row.provider === 'META_ADS' ? field.name : field.field;
        const answer =
          row.provider === 'META_ADS'
            ? Array.isArray(field.values) && field.values.length === 1
              ? field.values[0]
              : undefined
            : field.value;
        if (typeof key !== 'string') throw new Error('INVALID_FIELD');
        // Multi-select/object/null answers remain unknown, never affirmative consent.
        // The original notification is retained for operator review.
        if (typeof answer !== 'string') return [];
        // Keep original question names for configured qualification mappings.
        return [{ column_id: key, string_value: answer }];
      });
      const defaults = {
        firstname: 'first_name',
        lastname: 'last_name',
        email: 'email',
        phone: 'phone_number',
      };
      const mapping = Object.hasOwn(mappings, formId) ? mappings[formId] : {};
      const fullNameField = row.provider === 'META_ADS' ? 'full_name' : 'name';
      const fullName = columns.find((column) => column.column_id === fullNameField);
      if (fullName && !columns.some((column) => column.column_id === 'FULL_NAME'))
        columns.push({ ...fullName, column_id: 'FULL_NAME' });
      const lead = googleLeadMapper(
        {
          lead_id: id,
          form_id: formId,
          user_column_data: columns,
          campaign_id: details.campaign_id,
          adgroup_id: details.adset_id || details.adgroup_id,
          creative_id: details.ad_id,
          lead_submit_time: timestamp(details.created_time || details.create_time),
          is_test: env.SOCIAL_LEADS_TEST_MODE !== 'false',
        },
        { [formId]: { ...mapping, fields: { ...defaults, ...mapping.fields } } },
      );
      lead.source = row.provider;
      lead.consentSource = row.provider;
      lead.metadata = {
        fullName: fullName?.string_value,
        accountId: row.provider === 'META_ADS' ? entry.id : entry.advertiser_id,
        deliveryMethod: 'native_webhook',
      };
      const eventId = randomUUID();
      const payload = JSON.stringify({ inboxId: row.id, externalLeadId: id, formId });
      await env.DB.prepare(
        "INSERT INTO webhook_events(id,provider,event_type,received_at,processing_status,payload_json) VALUES (?,?,'LEAD',?,'RECEIVED',?)",
      )
        .bind(eventId, row.provider, Date.now(), payload)
        .run();
      try {
        await ingestLead(env, lead, siteUrl(), { id: eventId, payload });
      } catch {
        await env.DB.prepare(
          "UPDATE webhook_events SET processing_status='FAILED',error_message='INGESTION_FAILED' WHERE id=?",
        )
          .bind(eventId)
          .run();
        throw new Error('INGESTION_FAILED');
      }
      await env.DB.prepare('UPDATE social_webhook_inbox SET cursor=? WHERE id=?')
        .bind(position, row.id)
        .run();
      processed++;
    }
  }
  return true;
}

export async function processSocialInbox(env: LeadBindings) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT id,provider,payload_json,attempts,cursor FROM social_webhook_inbox WHERE status IN ('pending','processing') AND next_attempt_at<=? AND lease_until<? ORDER BY received_at LIMIT 3",
  )
    .bind(now, now)
    .all<InboxRow>();
  for (const row of results) {
    const claim = await env.DB.prepare(
      "UPDATE social_webhook_inbox SET status='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','processing') AND lease_until<?",
    )
      .bind(Date.now() + 300000, row.id, Date.now())
      .run();
    if (!claim.meta.changes) continue;
    try {
      const complete = await processSocialPayload(row, env);
      await env.DB.prepare(
        'UPDATE social_webhook_inbox SET status=?,processed_at=?,lease_until=0,error_code=NULL,attempts=0 WHERE id=?',
      )
        .bind(complete ? 'processed' : 'pending', complete ? Date.now() : null, row.id)
        .run();
    } catch {
      await env.DB.prepare(
        "UPDATE social_webhook_inbox SET status=?,next_attempt_at=?,lease_until=0,error_code='PROCESSING_FAILED' WHERE id=?",
      )
        .bind(
          row.attempts >= 9 ? 'failed' : 'pending',
          Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts),
          row.id,
        )
        .run();
    }
  }
  await env.DB.prepare(
    "DELETE FROM social_webhook_inbox WHERE received_at<? AND status='processed'",
  )
    .bind(Date.now() - 30 * 86400000)
    .run();
}
