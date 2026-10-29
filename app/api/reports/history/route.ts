import { reportAccess } from '@/lib/reportAuth';

const owner = 'BinaryBaker2025';
const repository = 'cartrack-dashcam-landingpage';
const pageSize = 30;
const exportPageSize = 100;

type GitHubCommit = {
  sha?: unknown;
  commit?: {
    message?: unknown;
    author?: { name?: unknown; date?: unknown } | null;
  };
  author?: { login?: unknown } | null;
};

function isCommit(value: unknown): value is GitHubCommit {
  return value !== null && typeof value === 'object';
}

export async function GET(request: Request) {
  const denied = reportAccess(request);
  if (denied) return denied;

  const searchParams = new URL(request.url).searchParams;
  const requestedPage = searchParams.get('page') || '1';
  const page = Number(requestedPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    return Response.json(
      { error: 'Choose a valid history page.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  const requestedPageSize = Number(searchParams.get('per_page') || pageSize);
  if (![pageSize, exportPageSize].includes(requestedPageSize))
    return Response.json(
      { error: 'Choose a valid history page size.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/commits?sha=main&per_page=${requestedPageSize}&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'CarTrack-Owner-Reports',
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      },
    );
    if (!response.ok)
      return Response.json(
        { error: 'GitHub change history is temporarily unavailable. Please try again later.' },
        { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
      );

    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.every(isCommit))
      throw new Error('GitHub returned an unexpected commit history response.');

    const commits = data.flatMap((item) => {
      const sha = typeof item.sha === 'string' ? item.sha : '';
      const message = item.commit?.message;
      const date = item.commit?.author?.date;
      if (!/^[0-9a-f]{40}$/i.test(sha) || typeof message !== 'string') return [];
      return [
        {
          sha,
          shortSha: sha.slice(0, 7),
          message: message.slice(0, 2000),
          author:
            (typeof item.author?.login === 'string' && item.author.login) ||
            (typeof item.commit?.author?.name === 'string' && item.commit.author.name) ||
            'Unknown author',
          date: typeof date === 'string' && Number.isFinite(Date.parse(date)) ? date : null,
          url: `https://github.com/${owner}/${repository}/commit/${sha}`,
        },
      ];
    });

    return Response.json(
      {
        commits,
        page,
        hasNext: /<[^>]+>;\s*rel="next"/.test(response.headers.get('link') || ''),
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          Vary: 'Authorization',
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'GitHub change history could not be loaded. Please try again later.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
