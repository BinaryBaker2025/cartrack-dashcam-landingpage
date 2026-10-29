import { expect, test } from '@playwright/test';

const sha = 'a'.repeat(40);

test('owner change history renders GitHub commits with dates and source links', async ({
  page,
}) => {
  await page.route('**/api/reports/history?page=1&per_page=30', (route) =>
    route.fulfill({
      json: {
        commits: [
          {
            sha,
            shortSha: sha.slice(0, 7),
            message: 'Restore optional email\n\nKeep it optional on the quote form.',
            author: 'project-user',
            date: '2026-10-28T10:00:00Z',
            url: `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${sha}`,
          },
        ],
        page: 1,
        hasNext: false,
      },
    }),
  );

  await page.goto('/reports/history');

  await expect(page.getByRole('link', { name: 'Best Car Dash owner reporting' })).toContainText(
    'bestcardash.com',
  );
  await expect(page.getByRole('heading', { name: 'Change history', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Restore optional email', level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('Keep it optional on the quote form.')).toBeVisible();
  await expect(page.getByText(/project-user ·/)).toBeVisible();
  await expect(page.getByRole('link', { name: /aaaaaaa/ })).toHaveAttribute(
    'href',
    `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${sha}`,
  );
  await expect(page.getByRole('button', { name: 'Older' })).toBeDisabled();
});

test('owner change history explains when sign-in is required', async ({ page }) => {
  await page.route('**/api/reports/history?page=1&per_page=30', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'text/plain',
      body: 'Owner sign-in required.',
    }),
  );

  await page.goto('/reports/history');

  const error = page.locator('main [role="alert"]');
  await expect(error).toContainText('Owner sign-in required. Reload this page and sign in again.');
  await expect(error).not.toContainText('JSON');
});

test('exports every commit with dates to an Excel workbook', async ({ page }) => {
  const commits = [
    {
      sha,
      shortSha: sha.slice(0, 7),
      message: 'Recent update',
      author: 'project-user',
      date: '2026-10-28T10:00:00Z',
      url: `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${sha}`,
    },
    {
      sha: 'b'.repeat(40),
      shortSha: 'bbbbbbb',
      message: 'Earlier update',
      author: 'another-user',
      date: '2026-10-27T09:00:00Z',
      url: `https://github.com/BinaryBaker2025/cartrack-dashcam-landingpage/commit/${'b'.repeat(40)}`,
    },
  ];
  const requestedPages: string[] = [];
  await page.route('**/api/reports/history**', async (route) => {
    const url = new URL(route.request().url());
    const perPage = url.searchParams.get('per_page');
    requestedPages.push(`${url.searchParams.get('page')}:${perPage}`);
    await route.fulfill({
      json: {
        commits: perPage === '100' ? commits : commits.slice(0, 1),
        page: Number(url.searchParams.get('page')),
        hasNext: false,
      },
    });
  });

  await page.goto('/reports/history');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('bestcardash-change-history.xlsx');
  expect(requestedPages).toContain('1:100');
});
