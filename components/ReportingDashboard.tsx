'use client';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './ReportingDashboard.module.css';

type Count = { count: number; status?: string; event?: string; source?: string; day?: string };
type ValidationFailure = { field: string; reason: string; count: number };
type Lead = {
  request_id: string;
  submitted_at_utc: string;
  firstname: string;
  lastname: string;
  phone1: string;
  email: string;
  source: string;
  processing_status: string;
  delivery_status: string;
  leadbyte_code: number | null;
  leadbyte_code_description: string | null;
  leadbyte_lead_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  is_test: number;
};
type Report = {
  filters: { from: string; to: string; page: number; search: string };
  statuses: Count[];
  daily: Count[];
  sources: Count[];
  events: Count[];
  validationFailures: ValidationFailure[];
  leads: Lead[];
  total: number;
  generatedAt: string;
};
const number = (value: number) => new Intl.NumberFormat('en-ZA').format(value);
const label = (value: string) => value.replaceAll('_', ' ');
const validationGuidance: Record<string, { title: string; explanation: string }> = {
  'name:format': {
    title: 'Name format',
    explanation:
      'The name must use letters. Spaces, apostrophes and hyphens are supported; numbers and other symbols are rejected.',
  },
  'mobile:format': {
    title: 'Mobile number format',
    explanation:
      'The number must be a valid South African mobile number. Check the digits and try a common format such as 082 123 4567 or +27 82 123 4567.',
  },
  'email:format': {
    title: 'Email format',
    explanation:
      'Email is optional, but when entered it must look like a valid address, for example name@example.com.',
  },
  'eligibility:required': {
    title: 'Eligibility confirmation',
    explanation:
      'The visitor did not confirm the age, vehicle, employment and income requirements before continuing.',
  },
  'consent:required': {
    title: 'Terms and privacy consent',
    explanation: 'The form was submitted without confirming the terms and privacy disclosure.',
  },
  'honeypot:filled': {
    title: 'Anti-spam check',
    explanation:
      'A hidden anti-spam field was filled. This often indicates automated traffic rather than a visitor.',
  },
};
export default function ReportingDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  async function exportExcel() {
    if (!report || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams({
        from: report.filters.from,
        to: report.filters.to,
        search: report.filters.search,
        export: 'all',
      });
      const response = await fetch(`/api/reports?${params}`, { cache: 'no-store' });
      if (response.status === 401)
        throw new Error('Owner sign-in required. Reload the page and sign in again.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Export could not be loaded.');
      const [{ default: writeExcelFile }, { reportSheets }] = await Promise.all([
        import('write-excel-file/universal'),
        import('@/lib/reportWorkbook'),
      ]);
      const blob = await writeExcelFile(reportSheets(data)).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cartrack-report-${data.filters.from}-to-${data.filters.to}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401)
          throw new Error('Owner sign-in required. Reload this page to sign in.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Reports could not be loaded.');
        setReport(data);
        setLoading(false);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, revision]);
  function reload(next = query) {
    setLoading(true);
    setError('');
    setQuery(next);
    setRevision((value) => value + 1);
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const field of ['from', 'to', 'search']) {
      const value = String(data.get(field) || '');
      if (value) params.set(field, value);
    }
    reload(params.toString());
  }
  function page(next: number) {
    const params = new URLSearchParams(query);
    params.set('page', String(next));
    reload(params.toString());
  }
  const total = report?.statuses.reduce((sum, row) => sum + row.count, 0) || 0;
  const accepted = report?.statuses.find((row) => row.status === 'accepted')?.count || 0;
  const eventCount = (name: string) => report?.events.find((row) => row.event === name)?.count || 0;
  const max = Math.max(1, ...(report?.daily.map((row) => row.count) || []));
  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <a href="/reports" className={styles.brand}>
          CarTrack <span>CAMERAS</span>
        </a>
        <nav className={styles.headerNav} aria-label="Owner reports">
          <a href="/reports" aria-current="page">
            Performance
          </a>
          <a href="/reports/history">Change history</a>
        </nav>
        <span className={styles.private}>Owner reporting</span>
      </header>
      <div className={styles.content}>
        <div className={styles.title}>
          <div>
            <p className={styles.eyebrow}>BESTCARDASH.COM</p>
            <h1>Performance overview</h1>
            <p>Website activity and lead delivery, in one place.</p>
          </div>
          <button onClick={() => reload()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh data'}
          </button>
        </div>
        <form className={styles.filters} onSubmit={filter}>
          <label>
            From
            <input
              key={`from-${report?.filters.from}`}
              type="date"
              name="from"
              defaultValue={report?.filters.from}
              required
            />
          </label>
          <label>
            To
            <input
              key={`to-${report?.filters.to}`}
              type="date"
              name="to"
              defaultValue={report?.filters.to}
              required
            />
          </label>
          <label className={styles.search}>
            Find a lead
            <input
              name="search"
              type="search"
              placeholder="Name, phone, email or request ID"
              maxLength={100}
            />
          </label>
          <button disabled={loading}>Apply filters</button>
        </form>
        <p className={styles.note}>
          Dates use South African time (UTC+2). Summary totals cover the date range; search filters
          lead records only. Test leads are included and labelled.
        </p>
        {error && (
          <div role="alert" className={styles.error}>
            {error} <button onClick={() => reload()}>Try again</button>
          </div>
        )}
        {exportError && (
          <p className={styles.error} role="alert">
            {exportError}
          </p>
        )}
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className={styles.placeholder}>Loading the latest reporting data…</div>
          ) : (
            !error &&
            report && (
              <>
                <section className={styles.metrics} aria-label="Key metrics">
                  {[
                    ['Page views', eventCount('landing_page_view')],
                    ['Forms started', eventCount('form_started')],
                    ['Recorded leads', total],
                    ['Accepted by LeadByte', accepted],
                  ].map(([title, value]) => (
                    <article key={title}>
                      <p>{title}</p>
                      <strong>{number(Number(value))}</strong>
                    </article>
                  ))}
                </section>
                <p className={styles.note}>
                  Activity counts start when tracking is deployed and may include repeat visits or
                  bots. They are not unique visitors. Accepted leads are submission
                  acknowledgements, not sales.
                </p>
                <div className={styles.panels}>
                  <section className={styles.panel}>
                    <h2>Daily lead volume</h2>
                    <p>Recorded leads by submission date</p>
                    {report.daily.length ? (
                      <div className={styles.chart}>
                        {report.daily.map((row) => (
                          <div key={row.day} className={styles.barRow}>
                            <span>{row.day}</span>
                            <div>
                              <i style={{ width: `${Math.max(1, (row.count / max) * 100)}%` }} />
                            </div>
                            <strong>{number(row.count)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.empty}>No leads recorded for this date range.</p>
                    )}
                  </section>
                  <section className={styles.panel}>
                    <h2>Delivery and sources</h2>
                    <p>Current lead status across all channels</p>
                    {report.statuses.map((row) => (
                      <div className={styles.breakdown} key={row.status}>
                        <span>{label(row.status || '')}</span>
                        <strong>{number(row.count)}</strong>
                      </div>
                    ))}
                    <h3>Ingestion source</h3>
                    {report.sources.map((row) => (
                      <div className={styles.breakdown} key={row.source}>
                        <span>{label(row.source || 'Unknown')}</span>
                        <strong>{number(row.count)}</strong>
                      </div>
                    ))}
                  </section>
                </div>
                <section className={styles.panel}>
                  <h2>Website activity</h2>
                  <p>Anonymous browser event counts. Delivery totals above come from SQL.</p>
                  <div className={styles.events}>
                    {[
                      'landing_page_view',
                      'form_started',
                      'qualification_failed',
                      'form_validation_failed',
                      'lead_submit_started',
                      'lead_submit_success',
                      'lead_submit_rejected',
                      'lead_submit_error',
                    ].map((event) => (
                      <div key={event}>
                        <span>{label(event)}</span>
                        <strong>{number(eventCount(event))}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>Form validation failures</h2>
                  <p>
                    Why quote requests were blocked, grouped by field and reason for the selected
                    date range. Counts are anonymous; submitted values are not stored here.
                  </p>
                  {report.validationFailures.length ? (
                    report.validationFailures.map((failure) => (
                      <div
                        className={styles.validationFailure}
                        key={`${failure.field}-${failure.reason}`}
                      >
                        <div>
                          <strong>
                            {validationGuidance[`${failure.field}:${failure.reason}`]?.title ||
                              `${label(failure.field)} · ${label(failure.reason)}`}
                          </strong>
                          <p>
                            {validationGuidance[`${failure.field}:${failure.reason}`]
                              ?.explanation ||
                              'The submitted field did not pass validation. Check the field value and try again.'}
                          </p>
                        </div>
                        <strong className={styles.validationCount}>{number(failure.count)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className={styles.empty}>No validation failures for this date range.</p>
                  )}
                </section>
                <section className={styles.panel}>
                  <div className={styles.tableTitle}>
                    <div>
                      <h2>Lead records</h2>
                      <p>From the existing lead_reporting SQL view</p>
                    </div>
                    <div>
                      <span>{number(report.total)} matching records</span>{' '}
                      <button
                        onClick={exportExcel}
                        disabled={exporting || loading}
                        aria-busy={exporting}
                      >
                        {exporting ? 'Preparing Excel…' : 'Export Excel'}
                      </button>
                      <p>Includes all matching leads, overview and daily totals.</p>
                    </div>
                  </div>
                  <div className={styles.tableScroll}>
                    <table>
                      <caption className={styles.srOnly}>
                        Lead contact details, source and delivery results
                      </caption>
                      <thead>
                        <tr>
                          {[
                            'Submitted (SAST)',
                            'Contact',
                            'Source / campaign',
                            'Processing / delivery',
                            'LeadByte result',
                            'Request ID',
                          ].map((title) => (
                            <th key={title} scope="col">
                              {title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.leads.map((lead) => (
                          <tr key={lead.request_id}>
                            <td>
                              {new Date(
                                lead.submitted_at_utc.replace(' ', 'T') + 'Z',
                              ).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
                              {lead.is_test ? <small>Test lead</small> : null}
                            </td>
                            <td>
                              <strong>
                                {lead.firstname} {lead.lastname}
                              </strong>
                              <small>{lead.phone1}</small>
                              <small>{lead.email}</small>
                            </td>
                            <td>
                              {lead.source}
                              <small>
                                {lead.utm_source || 'No UTM source'} /{' '}
                                {lead.utm_campaign || 'No UTM campaign'}
                              </small>
                            </td>
                            <td>
                              {label(lead.processing_status || '')}
                              <small>{label(lead.delivery_status)}</small>
                            </td>
                            <td>
                              {lead.leadbyte_code_description ||
                                (lead.leadbyte_code == null
                                  ? 'Awaiting result'
                                  : `Code ${lead.leadbyte_code}`)}
                              <small>ID: {lead.leadbyte_lead_id ?? 'Not supplied'}</small>
                            </td>
                            <td>
                              <code>{lead.request_id}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!report.leads.length && (
                    <p className={styles.empty}>
                      No matching leads. Try another search or a wider date range.
                    </p>
                  )}
                  <nav className={styles.pagination} aria-label="Lead pages">
                    <button
                      onClick={() => page(report.filters.page - 1)}
                      disabled={report.filters.page <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {report.filters.page} of {Math.max(1, Math.ceil(report.total / 50))}
                    </span>
                    <button
                      onClick={() => page(report.filters.page + 1)}
                      disabled={report.filters.page * 50 >= report.total}
                    >
                      Next
                    </button>
                  </nav>
                </section>
                <footer className={styles.note}>
                  Updated{' '}
                  {new Date(report.generatedAt).toLocaleString('en-ZA', {
                    timeZone: 'Africa/Johannesburg',
                  })}{' '}
                  SAST · Read-only owner access · Contact data is private
                </footer>
              </>
            )
          )}
        </div>
      </div>
    </main>
  );
}
