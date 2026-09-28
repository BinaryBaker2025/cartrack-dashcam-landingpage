import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
if (!config.account_id) throw new Error('Set account_id in wrangler.jsonc before deploying.');
// OpenNext's generated Wrangler config can omit account_id. Carry the selected
// account through every CLI invocation, including D1 migrations, explicitly.
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.account_id };
const steps = [
  ['scripts/check-deployment.mjs'],
  ['scripts/build-cloudflare.mjs'],
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--remote',
    '--config',
    'wrangler.jsonc',
  ],
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'deploy'],
  ['scripts/indexnow.mjs'],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
