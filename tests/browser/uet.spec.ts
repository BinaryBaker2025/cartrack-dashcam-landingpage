import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Never send test visits or synthetic contact details to Microsoft.
  await page.route('https://bat.bing.net/**', (route) => route.abort());
});

test('UET defaults to denied, remembers consent across pages and supports withdrawal', async ({
  page,
}) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.uetq)).toEqual([
    'consent',
    'default',
    { ad_storage: 'denied' },
  ]);
  await expect(page.locator('head #microsoft-uet')).toHaveCount(1);
  await page.getByRole('button', { name: 'Accept advertising', exact: true }).click();
  expect(await page.evaluate(() => window.bestcardashAdConsent)).toBe('granted');
  await page.goto('/privacy');
  expect(await page.evaluate(() => window.uetq)).toEqual([
    'consent',
    'default',
    { ad_storage: 'denied' },
    'consent',
    'update',
    { ad_storage: 'granted' },
  ]);
  await page.getByRole('button', { name: 'Advertising preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Decline advertising', exact: true }).click();
  expect(await page.evaluate(() => window.bestcardashAdConsent)).toBe('denied');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Advertising preferences', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.bestcardashAdConsent)).toBe('denied');
});

test('enhanced conversions occur only for consented successful submissions', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
  await page.route('**/api/leads', (route) =>
    route.fulfill({
      json: { state: 'success', message: 'Accepted' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept advertising', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Testing');
  await page.getByLabel('South African mobile number').fill('0821234567');
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect
    .poll(() => page.evaluate(() => window.uetq))
    .toEqual(expect.arrayContaining(['event', 'lead_submit_success']));
  expect(await page.evaluate(() => window.uetq)).toContainEqual({
    pid: { em: 'test@example.com', ph: '+27821234567' },
  });
  expect(
    await page.evaluate(() =>
      window.dataLayer?.some((args) => {
        const call = Array.from(args);
        return (
          call[0] === 'event' &&
          call[1] === 'conversion' &&
          JSON.stringify(call[2]) ===
            JSON.stringify({ send_to: 'AW-18532625097/iwunCMSnqasdEMnVhYVF' })
        );
      }),
    ),
  ).toBe(true);
});

for (const state of ['success', 'duplicate', 'api_rejected']) {
  test(`no enhanced conversion for ${state} with advertising declined`, async ({ page }) => {
    await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
    await page.route('**/api/leads', (route) =>
      route.fulfill({
        json: { state, message: 'Synthetic result' },
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Decline advertising', exact: true }).click();
    await page.getByLabel('First name', { exact: true }).fill('Test');
    await page.getByLabel('Last name', { exact: true }).fill('Testing');
    await page.getByLabel('South African mobile number').fill('0821234567');
    await page.getByLabel('Email address').fill('test@example.com');
    const response = page.waitForResponse('**/api/leads');
    await page.getByRole('button', { name: 'CALL ME BACK' }).click();
    await response;
    if (state === 'success')
      await expect(
        page.getByRole('heading', { name: /Thank you for your application/ }),
      ).toBeVisible();
    else await expect(page.getByText('Synthetic result')).toBeVisible();
    expect(await page.evaluate(() => window.uetq)).toEqual([
      'consent',
      'default',
      { ad_storage: 'denied' },
      'consent',
      'update',
      { ad_storage: 'denied' },
    ]);
    expect(
      await page.evaluate(() =>
        window.dataLayer?.some((args) => {
          const call = Array.from(args);
          return call[0] === 'event' && call[1] === 'conversion';
        }),
      ),
    ).toBe(state === 'success');
  });
}
