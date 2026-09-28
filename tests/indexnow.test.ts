import { describe, expect, it, vi } from 'vitest';
import { submissionPayload, submitIndexNow } from '../scripts/indexnow.mjs';
import config from '../config/indexnow.json';
import { readFileSync } from 'node:fs';

describe('IndexNow', () => {
  it('ships a matching root ownership file and submits canonical URLs once', () => {
    expect(readFileSync(`public/${config.key}.txt`, 'utf8').trim()).toBe(config.key);
    expect(submissionPayload(config, [config.origin, `${config.origin}/`]).urlList).toEqual(
      config.urls,
    );
  });
  it.each(['https://other.example/', `${config.origin}/#x`, 'https://user:pass@bestcardash.com/'])(
    'rejects unsafe URL %s',
    (url) => {
      expect(() => submissionPayload(config, [url])).toThrow();
    },
  );
  it('rejects invalid batches and keys', () => {
    expect(() => submissionPayload(config, [])).toThrow();
    expect(() => submissionPayload(config, Array(10001).fill(config.origin))).toThrow();
    expect(() => submissionPayload({ ...config, key: '' }, config.urls)).toThrow();
  });
  it.each([200, 202])(
    'verifies ownership before submitting a bulk request (%s)',
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(config.key))
        .mockResolvedValueOnce(new Response(null, { status }));
      expect(await submitIndexNow(config, config.urls, fetcher)).toEqual({ status, count: 1 });
      expect(fetcher.mock.calls[0][0]).toBe(`${config.origin}/${config.key}.txt`);
      expect(fetcher.mock.calls[1][0]).toBe('https://www.bing.com/indexnow');
      expect(JSON.parse(fetcher.mock.calls[1][1].body).urlList).toEqual(config.urls);
    },
  );
  it('does not notify Bing when the deployed key is missing or stale', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('wrong key'));
    await expect(submitIndexNow(config, config.urls, fetcher)).rejects.toThrow('ownership file');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports throttling as a failure without an immediate retry loop', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(config.key))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(submitIndexNow(config, config.urls, fetcher)).rejects.toThrow('HTTP 429');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
