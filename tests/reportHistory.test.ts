import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/reports/history/route';

const password = 'synthetic-reporting-password-long-enough';
const sha = 'a'.repeat(40);

function request(path = '?page=1', authorization = `Basic ${btoa(`owner:${password}`)}`) {
  return new Request(`https://reports.bestcardash.com/api/reports/history${path}`, {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => vi.stubEnv('REPORTING_PASSWORD', password));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GitHub change history endpoint', () => {
  it('requires owner authentication', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request('?page=1', ''));
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates pagination before requesting GitHub', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request('?page=0'));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns sanitized commit details and follows GitHub pagination', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        [
          {
            sha,
            commit: {
              message: 'Restore email field\n\nFollow-up detail',
              author: {
                name: 'Commit Author',
                email: 'private@example.com',
                date: '2026-10-28T10:00:00Z',
              },
            },
            author: { login: 'project-user' },
          },
        ],
        {
          headers: {
            Link: '<https://api.github.com/repos/BinaryBaker2025/cartrack-dashcam-landingpage/commits?page=2>; rel="next"',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetcher);

    const response = await GET(request('?page=1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      commits: [
        {
          sha,
          shortSha: 'aaaaaaa',
          message: 'Restore email field\n\nFollow-up detail',
          author: 'project-user',
          date: '2026-10-28T10:00:00Z',
          url: `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${sha}`,
        },
      ],
      page: 1,
      hasNext: true,
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('commits?sha=main&per_page=30&page=1'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('returns a visible upstream error without exposing GitHub response details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private upstream text', { status: 403 })),
    );
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private upstream text');
  });
});
