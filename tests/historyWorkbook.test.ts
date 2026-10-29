import { expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/universal';
import { strFromU8, unzipSync } from 'fflate';
import { historySheets } from '../lib/historyWorkbook';

it('exports complete commit details with dates converted to SAST text cells', async () => {
  const sha = 'a'.repeat(40);
  const workbook = await writeExcelFile(
    historySheets([
      {
        sha,
        shortSha: sha.slice(0, 7),
        message: '=HYPERLINK("https://example.com")\n\nCommit details',
        author: 'project-user',
        date: '2026-10-28T10:00:00Z',
        url: `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${sha}`,
      },
    ]),
  ).toBlob();
  const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()));
  const workbookXml = strFromU8(files['xl/workbook.xml']);
  const allXml = Object.entries(files)
    .filter(([name]) => name.endsWith('.xml'))
    .map(([, data]) => strFromU8(data))
    .join('');

  expect(workbookXml).toContain('Change history');
  expect(allXml).toContain('Commit date (SAST)');
  expect(allXml).toContain('2026-10-28 12:00 SAST');
  expect(allXml).toContain('=HYPERLINK(');
  expect(allXml).toContain('project-user');
  expect(allXml).toContain('Commit details');
  expect(allXml).toContain(sha);
  expect(allXml).not.toContain('<f>');
});

it('leaves commit dates blank when GitHub does not provide one', async () => {
  const workbook = await writeExcelFile(
    historySheets([
      {
        sha: 'b'.repeat(40),
        shortSha: 'bbbbbbb',
        message: 'Date unavailable',
        author: 'project-user',
        date: null,
        url: 'https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/bbbbbbb',
      },
    ]),
  ).toBlob();
  const files = unzipSync(new Uint8Array(await workbook.arrayBuffer()));
  const xml = Object.entries(files)
    .filter(([name]) => name.endsWith('.xml'))
    .map(([, data]) => strFromU8(data))
    .join('');

  expect(xml).toContain('Date unavailable');
  expect(xml).not.toContain('Invalid Date');
});
