import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { reconcile } from '../lib/reconciliation.mjs';

const [localPath, vendorPath, outputPath] = process.argv.slice(2);
if (!localPath || !vendorPath || !outputPath)
  throw new Error(
    'Usage: npm run reconcile -- artifacts/local.json artifacts/leadbyte.json artifacts/matches.json',
  );
const local = JSON.parse(readFileSync(localPath, 'utf8'));
const vendor = JSON.parse(readFileSync(vendorPath, 'utf8'));
const output = resolve(outputPath);
if (existsSync(output)) throw new Error('Output already exists; choose a different output path.');
const report = reconcile(local.leads, Array.isArray(vendor) ? vendor : vendor.leads);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), scope: { from: local.from, to: local.to }, ...report },
    null,
    2,
  ) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(`Reconciled ${report.results.length} local records. Results saved to ${output}`);
