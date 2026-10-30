import type { Sheet, SheetData } from 'write-excel-file/universal';
import type { readReport } from './reporting';

type Report = Awaited<ReturnType<typeof readReport>>;
const text = (value: unknown) => ({ value: value == null ? '' : String(value), type: String });
const header = (values: string[]) =>
  values.map((value) => ({
    value,
    fontWeight: 'bold' as const,
    backgroundColor: '#A34415',
    textColor: '#FFFFFF',
  }));
const count = (value: unknown) => ({ value: Number(value || 0), type: Number });
const columns = [
  ['submitted_at_utc', 'Submitted (SAST)', 24],
  ['firstname', 'First name', 20],
  ['lastname', 'Last name', 20],
  ['phone1', 'Phone', 20],
  ['email', 'Email', 32],
  ['acquisition_source', 'Acquisition source', 24],
  ['source', 'Ingestion source', 20],
  ['utm_source', 'UTM source', 22],
  ['utm_campaign', 'UTM campaign', 30],
  ['processing_status', 'Processing status', 24],
  ['delivery_status', 'Delivery status', 24],
  ['leadbyte_code', 'LeadByte code', 16],
  ['leadbyte_code_description', 'LeadByte result', 38],
  ['leadbyte_response', 'LeadByte response', 48],
  ['diagnostic_code', 'Diagnostic code', 32],
  ['leadbyte_lead_id', 'LeadByte ID', 20],
  ['is_test', 'Test lead', 14],
  ['request_id', 'Request ID', 40],
] as const;

export function reportSheets(report: Report): Sheet<Blob>[] {
  if (report.leads.length > 1048575)
    throw new Error('Too many leads for one Excel sheet. Choose a shorter date range.');
  const summary: SheetData = [
    header(['Owner performance report', 'Value']),
    [text('From (SAST)'), text(report.filters.from)],
    [text('To (SAST)'), text(report.filters.to)],
    [text('Lead search'), text(report.filters.search || 'All leads')],
    [text('Generated (UTC)'), text(report.generatedAt)],
    [text('Matching leads exported'), count(report.leads.length)],
    [text('Summary scope'), text('Date range, all leads. Search applies to lead records only.')],
    [
      text('Activity scope'),
      text('Browser event counts, not unique visitors. Tracking starts at deployment.'),
    ],
    [text('Acceptance'), text('LeadByte acknowledgement, not a sale. Test leads are included.')],
    [],
    header(['Delivery status', 'Leads']),
    ...report.statuses.map((row) => [text(row.status), count(row.count)]),
    [],
    header(['Acquisition source', 'Leads']),
    ...report.sources.map((row) => [text(row.source), count(row.count)]),
    [],
    header(['Ingestion route', 'Leads']),
    ...report.ingestionSources.map((row) => [text(row.source), count(row.count)]),
    [],
    header(['Website event', 'Count']),
    ...report.events.map((row) => [text(row.event), count(row.count)]),
  ];
  const leads: SheetData = [
    header(columns.map(([, title]) => title)),
    ...report.leads.map((row) =>
      columns.map(([key]) => {
        if (key === 'submitted_at_utc' && row[key]) {
          const date = new Date(String(row[key]).replace(' ', 'T') + 'Z');
          return text(
            new Date(date.getTime() + 7200000).toISOString().replace('T', ' ').slice(0, 19),
          );
        }
        if (key === 'is_test') return text(row[key] ? 'Yes' : 'No');
        if (key === 'leadbyte_code' && row[key] != null) return count(row[key]);
        // Explicit string cells preserve leading zeroes and prevent formula execution.
        return text(row[key]);
      }),
    ),
  ];
  return [
    {
      sheet: 'Overview',
      data: summary,
      columns: [{ width: 32 }, { width: 95 }],
      stickyRowsCount: 1,
    },
    {
      sheet: 'Leads',
      data: leads,
      columns: columns.map(([, , width]) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      sheet: 'Daily leads',
      data: [
        header(['Submission date (SAST)', 'Leads']),
        ...report.daily.map((row) => [text(row.day), count(row.count)]),
      ],
      columns: [{ width: 26 }, { width: 16 }],
      stickyRowsCount: 1,
    },
  ];
}
