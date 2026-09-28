import type { D1Database, Queue } from '@cloudflare/workers-types';
export type LeadJob = { leadId: string };
export type LeadBindings = {
  DB: D1Database;
  LEAD_QUEUE: Queue<LeadJob>;
  GOOGLE_ADS_WEBHOOK_KEY?: string;
  MICROSOFT_ADS_WEBHOOK_TOKEN?: string;
  GOOGLE_ADS_FORM_MAPPINGS?: string;
};
export async function leadBindings(): Promise<LeadBindings> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as unknown as LeadBindings;
  if (!bindings.DB || !bindings.LEAD_QUEUE) throw new Error('PIPELINE_UNAVAILABLE');
  return bindings;
}
