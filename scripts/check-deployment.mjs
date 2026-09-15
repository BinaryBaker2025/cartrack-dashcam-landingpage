import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
const db = config.d1_databases.find((entry) => entry.binding === 'DB');
if (!db?.database_id || db.database_id === '00000000-0000-0000-0000-000000000000')
  throw new Error(
    'Create the Cloudflare D1 database and set its database_id in wrangler.jsonc first.',
  );
const site = new URL(config.vars.NEXT_PUBLIC_SITE_URL || 'https://unconfigured.invalid');
if (
  site.protocol !== 'https:' ||
  site.origin !== config.vars.NEXT_PUBLIC_SITE_URL ||
  site.hostname.endsWith('.invalid')
)
  throw new Error('Set vars.NEXT_PUBLIC_SITE_URL to the exact HTTPS Cloudflare site origin first.');
console.log('Deployment configuration is ready.');
