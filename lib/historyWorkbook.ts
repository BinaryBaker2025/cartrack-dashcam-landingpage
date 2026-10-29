import type { Sheet, SheetData } from 'write-excel-file/universal';

type Commit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string | null;
  url: string;
};

const text = (value: string | null) => ({ value: value || '', type: String });

function sastDate(value: string | null) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} SAST`;
}

export function historySheets(commits: Commit[]): Sheet<Blob>[] {
  if (commits.length > 1_048_575)
    throw new Error('Too many commits for one Excel sheet. Export a smaller history range.');

  const header = ['Commit date (SAST)', 'Commit message', 'Author', 'Commit SHA', 'GitHub URL'].map(
    (value) => ({
      value,
      fontWeight: 'bold' as const,
      backgroundColor: '#07388F',
      textColor: '#FFFFFF',
    }),
  );
  const data: SheetData = [
    header,
    ...commits.map((commit) => [
      text(sastDate(commit.date)),
      text(commit.message),
      text(commit.author),
      text(commit.sha),
      text(commit.url),
    ]),
  ];

  return [
    {
      sheet: 'Change history',
      data,
      columns: [{ width: 27 }, { width: 70 }, { width: 24 }, { width: 44 }, { width: 80 }],
      stickyRowsCount: 1,
    },
  ];
}
