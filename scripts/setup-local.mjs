import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

const read = (file) => (existsSync(file) ? parse(readFileSync(file)) : {});
const current = read('.env.local');
const vars = read('.dev.vars');
const secret = current.LEAD_HASH_SECRET || vars.LEAD_HASH_SECRET || randomBytes(32).toString('hex');
const shared = {
  DEPLOY_PLATFORM: 'cloudflare',
  DEPLOY_ENV: 'development',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  LEADBYTE_ENABLED: 'false',
  SITE_INDEXABLE: 'false',
  LEAD_HASH_SECRET: secret,
  GOOGLE_ADS_WEBHOOK_KEY: vars.GOOGLE_ADS_WEBHOOK_KEY || randomBytes(32).toString('hex'),
  GOOGLE_ADS_FORM_MAPPINGS: vars.GOOGLE_ADS_FORM_MAPPINGS || '{}',
};
const serialize = (values) =>
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n';
writeFileSync('.env.local', serialize({ ...current, ...shared }));
writeFileSync('.dev.vars', serialize({ ...vars, ...shared, NEXTJS_ENV: 'development' }));
console.log('Local Cloudflare settings saved. Live lead delivery is disabled.');
