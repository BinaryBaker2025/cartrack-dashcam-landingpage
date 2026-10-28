import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [375, 390, 430, 768, 1024, 1280, 1440, 1870]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'See more. Worry less.' })).toBeVisible();
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
test('shows revised pricing and explicit eligibility and consent checkboxes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.campaign-price-line')).toContainText('R6.99/day*');
  await expect(page.locator('.campaign-terms')).toContainText('Terms and conditions apply.');
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('#eligibilityConfirmed')).not.toBeChecked();
  await expect(page.locator('#terms')).not.toBeChecked();
});
test('shows the campaign hero above the name-and-phone form', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.campaign-hero');
  const photo = hero.locator('.campaign-photo img');
  const name = page.getByLabel('Name', { exact: true });
  await expect(hero).toContainText('R10,000');
  await expect(hero).toContainText('on our annual draw');
  await expect(hero.locator('.campaign-partner')).toContainText('In association with');
  await expect(hero.locator('.campaign-partner img')).toHaveAttribute('alt', 'Cartrack');
  await expect(page.locator('.footer')).toContainText('In association with LeadByte and Cartrack.');
  await expect(photo).toBeVisible();
  await expect(name).toBeVisible();
  await expect(page.getByLabel('South African mobile number')).toBeVisible();
  await expect(page.getByLabel('Last name', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  const submit = page.getByRole('button', { name: 'Get Quote & Qualify' });
  await expect(submit).toBeVisible();
  await expect(submit).toHaveCSS('background-color', 'rgb(7, 56, 143)');
  await expect(submit).toHaveCSS('min-height', '60px');
  await expect(page.locator('.campaign-cta')).toHaveCSS('min-height', '60px');
  await expect(page.locator('.campaign-draw-badge')).toContainText('R10,000');
  expect((await hero.boundingBox())!.y).toBeLessThan((await name.boundingBox())!.y);
  await expect(photo).toHaveAttribute(
    'alt',
    'A driver with a Cartrack dashcam installed on the windscreen',
  );
});
test('invalid submission shows inline messages without a network request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.locator('#name-error')).toBeVisible();
  expect(requests).toBe(0);
});
test('logs invalid fields and reason codes without sending the lead', async ({ page }) => {
  let leadRequests = 0;
  const analytics: { event: string; failures?: { field: string; reason: string }[] }[] = [];
  await page.route('**/api/leads', (route) => {
    leadRequests++;
    return route.abort();
  });
  await page.route('**/api/analytics', async (route) => {
    analytics.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill('Test Testing');
  await page.getByLabel('South African mobile number').fill('123');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.locator('#phone-error')).toBeVisible();
  await expect(page.locator('#eligibilityConfirmed-error')).toBeVisible();
  await expect(page.locator('#terms-error')).toBeVisible();
  await expect
    .poll(() => analytics.find((event) => event.event === 'form_validation_failed'))
    .toMatchObject({
      event: 'form_validation_failed',
      failures: [
        { field: 'eligibility', reason: 'required' },
        { field: 'mobile', reason: 'format' },
        { field: 'consent', reason: 'required' },
      ],
    });
  expect(leadRequests).toBe(0);
});
async function fillContact(page: import('@playwright/test').Page) {
  await page.getByLabel('Name', { exact: true }).fill('Test Testing');
  await page.getByLabel('South African mobile number').fill('0821234567');
  await page.locator('#eligibilityConfirmed').check();
  await page.locator('#terms').check();
}
const thankYouHeading = /Thank you for your application/;

test('Bing click attribution survives navigation and reaches the website lead request', async ({
  page,
}) => {
  const clickId = '0123456789abcdef0123456789abcdef';
  await page.route('**/api/leads', async (route) => {
    expect(route.request().postDataJSON().attribution).toMatchObject({
      msclkid: clickId,
      utm_source: 'bing',
      utm_medium: 'cpc',
      ms_campaign_id: '123',
      ms_adgroup_id: '456',
      ms_ad_id: '789',
    });
    await route.fulfill({
      json: { state: 'success', message: 'Received', diagnostics: { code: 'LEAD_RECEIVED' } },
    });
  });
  await page.goto(
    `/?utm_source=bing&utm_medium=cpc&msclkid=${clickId}&ms_campaign_id=123&ms_adgroup_id=456&ms_ad_id=789`,
  );
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('cartrack-attribution')))
    .toContain(clickId);
  await page.goto('/');
  await fillContact(page);
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
});

test('accepted submission shows reference thank-you screen and prevents repeat delivery', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      firstname: 'Test',
      lastname: 'Testing',
      phone: '+27821234567',
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      eligibilityConfirmed: true,
      terms: true,
      attribution: { transaction_id: 'browser-test', offer_id: '999' },
    });
    expect(body).not.toHaveProperty('email');
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
  await page
    .getByRole('button', { name: 'Get Quote & Qualify' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Get Quote & Qualify' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(1);
});

test('single-step form requires a name', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByLabel('Name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.locator('#name-error')).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
});

test('duplicate response keeps the form editable and resubmits changed details', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    if (requests === 1) {
      await route.fulfill({
        status: 409,
        json: { state: 'duplicate', message: 'Already submitted.', duplicateFields: ['phone'] },
      });
      return;
    }
    await route.fulfill({ json: { state: 'success', message: 'Accepted' } });
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.locator('#phone-error')).toHaveText('This detail has already been submitted.');
  await expect(page.getByLabel('South African mobile number')).toBeEnabled();
  await page.getByLabel('South African mobile number').fill('0831234567');
  await expect(page.locator('#phone-error')).toHaveCount(0);
  await expect(page.getByRole('status')).not.toContainText('Already submitted.');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(2);
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
    await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
    await expect(page.getByRole('status')).toContainText(result.message);
    await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
  });
}
