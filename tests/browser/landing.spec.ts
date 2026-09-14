import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
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
test('qualified form captures attribution and prevents double click and resubmission', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body.attribution.transaction_id).toBe('browser-test');
    expect(body.attribution.offer_id).toBe('999');
    expect(body).not.toHaveProperty('offer_id');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      json: {
        state: 'success',
        message: 'Your request has been received. A CarTrack representative may contact you.',
      },
    });
  });
  await page.goto('/?transaction_id=browser-test&offer_id=999');
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Testing');
  await page.getByLabel('South African mobile number').fill('+27821234567');
  await page.getByLabel('Are you 18 or older?').selectOption('18_plus');
  await page.getByLabel('Do you have access to a vehicle?').selectOption('yes');
  await page.getByLabel('Employment status').selectOption('employed');
  await page.getByLabel('Monthly income').selectOption('10000_19999');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'CALL ME BACK' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('heading', { name: 'Your request is in.' })).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByRole('button', { name: 'CALL ME BACK' })).toHaveCount(0);
  await page.reload();
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Testing');
  await page.getByLabel('South African mobile number').fill('+27821234567');
  await page.getByLabel('Are you 18 or older?').selectOption('18_plus');
  await page.getByLabel('Do you have access to a vehicle?').selectOption('yes');
  await page.getByLabel('Employment status').selectOption('employed');
  await page.getByLabel('Monthly income').selectOption('10000_19999');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.getByRole('heading', { name: 'Your request is in.' })).toBeVisible();
  expect(requests).toBe(1);
});
