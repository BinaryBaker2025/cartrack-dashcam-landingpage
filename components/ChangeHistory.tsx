'use client';
import { useEffect, useState } from 'react';
import styles from './ReportingDashboard.module.css';

type Commit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string | null;
  url: string;
};
type History = { commits: Commit[]; page: number; hasNext: boolean };
const maxExportPages = 50;

async function fetchHistory(page: number, perPage = 30, signal?: AbortSignal): Promise<History> {
  const response = await fetch(`/api/reports/history?page=${page}&per_page=${perPage}`, {
    cache: 'no-store',
    signal,
  });
  if (response.status === 401)
    throw new Error('Owner sign-in required. Reload this page and sign in again.');

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'Change history returned an unreadable response. Please try again.'
        : `Change history could not be loaded (HTTP ${response.status}).`,
    );
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Change history could not be loaded (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!isHistory(data))
    throw new Error('Change history returned an unexpected response. Please try again.');
  return data;
}

function isHistory(value: unknown): value is History {
  if (!value || typeof value !== 'object') return false;
  const history = value as Partial<History>;
  return (
    Number.isSafeInteger(history.page) &&
    typeof history.hasNext === 'boolean' &&
    Array.isArray(history.commits) &&
    history.commits.every(
      (commit) =>
        commit &&
        typeof commit === 'object' &&
        typeof commit.sha === 'string' &&
        typeof commit.shortSha === 'string' &&
        typeof commit.message === 'string' &&
        typeof commit.author === 'string' &&
        (typeof commit.date === 'string' || commit.date === null) &&
        typeof commit.url === 'string',
    )
  );
}

export default function ChangeHistory() {
  const [history, setHistory] = useState<History | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportPage, setExportPage] = useState(0);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(page, 30, controller.signal)
      .then(setHistory)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Change history could not be loaded.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, revision]);

  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    setExportPage(0);
    setExportError('');
    try {
      const commits: Commit[] = [];
      let pageToLoad = 1;
      let hasNext = true;
      while (hasNext && pageToLoad <= maxExportPages) {
        setExportPage(pageToLoad);
        const result = await fetchHistory(pageToLoad, 100);
        commits.push(...result.commits);
        hasNext = result.hasNext;
        pageToLoad++;
      }
      if (hasNext)
        throw new Error(
          `The history exceeds the ${(maxExportPages * 100).toLocaleString('en-ZA')}-commit export limit. No partial file was downloaded.`,
        );

      const [{ default: writeExcelFile }, { historySheets }] = await Promise.all([
        import('write-excel-file/universal'),
        import('@/lib/historyWorkbook'),
      ]);
      const blob = await writeExcelFile(historySheets(commits)).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bestcardash-change-history.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'Excel export failed.');
    } finally {
      setExporting(false);
      setExportPage(0);
    }
  }

  function showPage(next: number) {
    setLoading(true);
    setError('');
    setPage(next);
  }

  function retry() {
    setLoading(true);
    setError('');
    setRevision((current) => current + 1);
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <a href="/reports" className={styles.brand} aria-label="Best Car Dash owner reporting">
          best<span>car</span>dash.com
        </a>
        <nav className={styles.headerNav} aria-label="Owner reports">
          <a href="/reports">Performance</a>
          <a href="/reports/history" aria-current="page">
            Change history
          </a>
        </nav>
        <span className={styles.private}>Owner reporting</span>
      </header>
      <div className={styles.content}>
        <div className={styles.title}>
          <div>
            <p className={styles.eyebrow}>BESTCARDASH.COM</p>
            <h1>Change history</h1>
            <p>Changes committed to the project’s GitHub main branch.</p>
          </div>
          <div className={styles.titleActions}>
            <button className={styles.exportButton} onClick={exportExcel} disabled={exporting}>
              {exporting ? `Preparing Excel (page ${exportPage})…` : 'Export Excel'}
            </button>
            {exportError && (
              <p className={styles.exportError} role="alert">
                {exportError}
              </p>
            )}
          </div>
        </div>
        <p className={styles.note}>
          Updates appear after they are committed and pushed to GitHub. Work in progress and
          unpushed changes are not shown.
        </p>
        {error && (
          <div role="alert" className={styles.error}>
            {error} <button onClick={retry}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className={styles.placeholder} aria-live="polite">
            Loading GitHub history…
          </div>
        ) : !error && history ? (
          <>
            <section className={styles.historyPanel} aria-label="GitHub commits">
              <p className={styles.historyMeta}>
                {history.commits.length
                  ? `Showing ${history.commits.length} commits, newest first`
                  : 'No commits found on this page'}
              </p>
              {history.commits.map((commit) => (
                <article className={styles.commit} key={commit.sha}>
                  <div className={styles.commitDetails}>
                    <h2>{commit.message.split('\n')[0]}</h2>
                    {commit.message.includes('\n') && (
                      <p className={styles.commitBody}>
                        {commit.message.split('\n').slice(1).join('\n').trim()}
                      </p>
                    )}
                    <p className={styles.commitMeta}>
                      {commit.author} ·{' '}
                      {commit.date
                        ? `${new Date(commit.date).toLocaleString('en-ZA', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Africa/Johannesburg',
                          })} SAST`
                        : 'Date not supplied'}
                    </p>
                  </div>
                  <a
                    className={styles.commitLink}
                    href={commit.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {commit.shortSha}
                    <span className={styles.srOnly}> (opens on GitHub)</span>
                  </a>
                </article>
              ))}
            </section>
            <nav className={styles.pagination} aria-label="Change history pages">
              <button onClick={() => showPage(page - 1)} disabled={page <= 1}>
                Newer
              </button>
              <span>Page {page}</span>
              <button onClick={() => showPage(page + 1)} disabled={!history.hasNext}>
                Older
              </button>
            </nav>
          </>
        ) : null}
      </div>
    </main>
  );
}
