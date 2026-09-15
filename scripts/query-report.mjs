import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = { daily: 'reports/daily.sql', issues: 'reports/reconciliation-issues.sql' };
const file = files[process.argv[2]];
if (!file) throw new Error('Choose daily or issues.');
// --command returns SELECT results; Wrangler --file uses a bulk import workflow.
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'DB',
    '--remote',
    `--command=${readFileSync(file, 'utf8')}`,
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
