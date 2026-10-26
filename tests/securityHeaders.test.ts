import { expect, it } from 'vitest';
import config from '../next.config';

it('allows Google Ads page-view requests through the content security policy', async () => {
  const headers = await config.headers?.();
  const policy = headers
    ?.flatMap(({ headers: responseHeaders }) => responseHeaders)
    .find(({ key }) => key === 'Content-Security-Policy')?.value;
  const directives = policy?.split(';');
  const imageSources = directives?.find((directive) => directive.trim().startsWith('img-src '));
  const connectionSources = directives?.find((directive) =>
    directive.trim().startsWith('connect-src '),
  );

  expect(imageSources).toContain('https://ad.doubleclick.net');
  expect(connectionSources).toContain('https://ad.doubleclick.net');
  expect(imageSources).toContain('https://pagead2.googlesyndication.com');
  expect(connectionSources).toContain('https://pagead2.googlesyndication.com');
});
