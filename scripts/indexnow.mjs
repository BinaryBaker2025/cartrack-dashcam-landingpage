import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function submissionPayload(config, urls) {
  const site = new URL(config.origin);
  if (site.protocol !== 'https:' || site.origin !== config.origin)
    throw new Error('IndexNow requires an exact HTTPS production origin.');
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(config.key)) throw new Error('Invalid IndexNow key.');
  if (!Array.isArray(urls) || !urls.length || urls.length > 10000)
    throw new Error('Supply between 1 and 10,000 URLs.');
  const urlList = [
    ...new Set(
      urls.map((value) => {
        const url = new URL(value);
        if (url.origin !== site.origin || url.username || url.password || url.hash)
          throw new Error(
            'Submit only URLs on the configured origin, without credentials or fragments.',
          );
        return url.href;
      }),
    ),
  ];
  return {
    host: site.host,
    key: config.key,
    keyLocation: `${site.origin}/${config.key}.txt`,
    urlList,
  };
}

export async function submitIndexNow(config, urls, fetcher = fetch) {
  const payload = submissionPayload(config, urls);
  // Check the deployed ownership file before sending any notification.
  const verification = await fetcher(payload.keyLocation, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!verification.ok || (await verification.text()).trim() !== payload.key)
    throw new Error(
      'IndexNow ownership file is not live or does not match. Deploy first, then retry npm run indexnow.',
    );
  const response = await fetcher('https://www.bing.com/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200 && response.status !== 202)
    throw new Error(
      `IndexNow returned HTTP ${response.status}. The site deployment is unaffected; retry npm run indexnow after resolving the response (wait before retrying 429).`,
    );
  return { status: response.status, count: payload.urlList.length };
}

async function main() {
  const config = JSON.parse(
    readFileSync(new URL('../config/indexnow.json', import.meta.url), 'utf8'),
  );
  const hosting = JSON.parse(
    readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(
      /,\s*([}\]])/g,
      '$1',
    ),
  );
  if (
    hosting.vars.DEPLOY_ENV !== 'production' ||
    hosting.vars.SITE_INDEXABLE !== 'true' ||
    hosting.vars.NEXT_PUBLIC_SITE_URL !== config.origin
  )
    throw new Error('IndexNow is restricted to the configured indexable production site.');
  if (
    (process.env.DEPLOY_ENV && process.env.DEPLOY_ENV !== 'production') ||
    (process.env.CONTEXT && process.env.CONTEXT !== 'production') ||
    (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
  )
    throw new Error('IndexNow notifications are disabled in non-production environments.');
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const supplied = args.filter((arg) => arg !== '--dry-run');
  const urls = supplied.length ? supplied : config.urls;
  const payload = submissionPayload(config, urls);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const result = await submitIndexNow(config, urls);
  console.log(
    `IndexNow: ${result.count} URL(s) ${result.status === 202 ? 'received; key verification pending' : 'received'}. Indexing is at the search engine’s discretion.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
