import { expect, test } from '@playwright/test';

const sha = 'a'.repeat(40);

test('owner change history renders GitHub commits with dates and source links', async ({
  page,
}) => {
  await page.route('**/api/reports/history?page=1', (route) =>
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
