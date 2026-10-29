import { expect, test } from '@playwright/test';

test('report explains the reason behind aggregated form validation failures', async ({ page }) => {
  await page.route('**/api/reports**', (route) =>
    route.fulfill({
      json: {
        filters: { from: '2026-10-01', to: '2026-10-29', page: 1, search: '' },
        statuses: [],
        daily: [],
        sources: [],
        events: [],
        validationFailures: [
          { field: 'mobile', reason: 'format', count: 3 },
          { field: 'email', reason: 'format', count: 1 },
        ],
        leads: [],
        total: 0,
        generatedAt: '2026-10-29T08:00:00.000Z',
      },
    }),
  );

  await page.goto('/reports');

  const section = page.getByRole('heading', { name: 'Form validation failures' }).locator('..');
  await expect(section.getByText('Mobile number format')).toBeVisible();
  await expect(
    section.getByText(/valid South African mobile number.*082 123 4567 or \+27 82 123 4567/),
  ).toBeVisible();
  await expect(section.getByText('Email format')).toBeVisible();
  await expect(section.getByText('3', { exact: true })).toBeVisible();
  await expect(section.getByText('1', { exact: true })).toBeVisible();
  await expect(
    section.getByText(/Counts are anonymous; submitted values are not stored here/),
  ).toBeVisible();
});
