import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [375, 390, 430, 768, 1024, 1280, 1440, 1870]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'Protect your vehicle' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator('#quote')).toBeVisible();
    await page.screenshot({
      path: `artifacts/landing-${width}.png`,
      fullPage: true,
      caret: 'initial',
    });
  });
}
test('has no automated WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
test('shows revised pricing and a single disclaimer below the CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('From as little as R7 per day. Terms apply.')).toBeVisible();
  await expect(
    page.getByText(
      'By submitting this form, I confirm that I am 18 or older, have access to a vehicle and am employed.',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
});
test('invalid submission shows inline messages without a network request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.locator('#firstname-error')).toBeVisible();
  expect(requests).toBe(0);
});
async function fillContact(page: import('@playwright/test').Page) {
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Testing');
  await page.getByLabel('South African mobile number').fill('0821234567');
  await page.getByLabel('Email address').fill('test@example.com');
}
const thankYouHeading = /Thank you for your application/;

test('accepted submission shows reference thank-you screen and prevents repeat delivery', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      firstname: 'Test',
      email: 'test@example.com',
      phone: '+27821234567',
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      eligibilityConfirmed: true,
      terms: true,
      attribution: { transaction_id: 'browser-test', offer_id: '999' },
    });
    expect(body).not.toHaveProperty('offer_id');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      json: {
        state: 'success',
        message: 'Accepted',
        diagnostics: { code: 'LEADBYTE_SUCCESS', leadByteCode: 1 },
      },
    });
  });
  await page.goto('/?transaction_id=browser-test&offer_id=999');
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeFocused();
  await expect(page.getByRole('button', { name: 'CALL ME BACK' })).toHaveCount(0);
  expect(requests).toBe(1);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  for (const width of [1887, 390]) {
    await page.setViewportSize({ width, height: 858 });
    await page.screenshot({ path: `artifacts/thank-you-${width}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.reload();
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(1);
});

test('single-step form requires email', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByLabel('Email address').fill('');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.locator('#email-error')).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
});

for (const result of [
  { status: 409, state: 'duplicate', message: 'Already submitted.' },
  { status: 503, state: 'temporary_error', message: 'Please try again later.' },
  { status: 422, state: 'api_rejected', message: 'Campaign unavailable.' },
  { status: 503, state: 'success', message: 'Invalid success response.' },
]) {
  test(`does not show thank-you for ${result.status} ${result.state}`, async ({ page }) => {
    await page.route('**/api/leads', (route) =>
      route.fulfill({ status: result.status, json: result }),
    );
    await page.goto('/');
    await fillContact(page);
    await page.getByRole('button', { name: 'CALL ME BACK' }).click();
    await expect(page.getByRole('status')).toContainText(result.message);
    await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
  });
}
