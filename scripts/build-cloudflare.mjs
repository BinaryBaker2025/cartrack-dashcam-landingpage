import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
// Explicit build settings override ignored local Next.js env files.
const env = {
  ...process.env,
  ...config.vars,
  NEXT_PUBLIC_SITE_URL:
    config.vars.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://unconfigured.invalid',
};
const result = spawnSync(
  process.execPath,
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build'],
  {
    stdio: 'inherit',
    env,
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
