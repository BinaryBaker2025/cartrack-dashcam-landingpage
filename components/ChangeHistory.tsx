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

export default function ChangeHistory() {
  const [history, setHistory] = useState<History | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports/history?page=${page}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401)
          throw new Error('Owner sign-in required. Reload this page and sign in again.');
        if (!response.ok) throw new Error(data.error || 'Change history could not be loaded.');
        setHistory(data);
      })
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
        <a href="/reports" className={styles.brand}>
          CarTrack <span>CAMERAS</span>
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
