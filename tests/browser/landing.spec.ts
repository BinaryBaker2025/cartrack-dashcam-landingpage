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
test('shows revised pricing and agreement by submission', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.campaign-price-line')).toContainText('R6.99/day*');
  await expect(page.locator('.campaign-terms')).toContainText('Terms and conditions apply.');
  await expect(page.locator('#quote input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator('#submission-agreement')).toHaveText(
    'By submitting, you agree to our Terms and Conditions and Privacy Policy.',
  );
});
test('shows the campaign hero above the name-and-phone form', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.campaign-hero');
  const photo = hero.locator('.campaign-photo img');
  const name = page.getByLabel('Full name', { exact: true });
  await expect(hero).toContainText('R10,000');
  await expect(hero).toContainText('Get a quote to win');
  await expect(hero).toContainText('in our annual draw');
  await expect(hero.locator('.campaign-partner')).toHaveCount(0);
  await expect(page.locator('.footer')).toContainText('In association with LeadByte.');
  await expect(page.locator('body')).not.toContainText(/cartrack/i);
  await expect(photo).toBeVisible();
  await expect(name).toBeVisible();
  await expect(page.getByLabel('South African mobile number')).toBeVisible();
  await expect(page.getByLabel('Last name', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toBeVisible();
  const submit = page.getByRole('button', { name: 'Get Quote & Qualify' });
  await expect(submit).toBeVisible();
  await expect(submit).toHaveCSS('background-color', 'rgb(7, 56, 143)');
  await expect(submit).toHaveCSS('min-height', '60px');
  await expect(page.locator('.campaign-cta')).toHaveCSS('min-height', '60px');
  await expect(page.locator('.campaign-draw-badge')).toContainText('R10,000');
  expect((await hero.boundingBox())!.y).toBeLessThan((await name.boundingBox())!.y);
  await expect(photo).toHaveAttribute(
    'alt',
    'A driver and three passengers travelling with a dashcam beneath the rear-view mirror',
  );
});
test('matches the supplied mobile banner layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Best Car Dash home' })).toContainText(
    'bestcardash.com',
  );
  await expect(page.locator('.campaign-draw-badge')).toBeVisible();
  await expect(page.locator('.campaign-draw-badge')).toContainText('Get a quote to win');
  const badgeWidth = await page
    .locator('.campaign-draw-badge')
    .evaluate((badge) => badge.getBoundingClientRect().width);
  const prizeFontSize = await page
    .locator('.campaign-prize')
    .evaluate((prize) => Number.parseFloat(getComputedStyle(prize).fontSize));
  expect(badgeWidth).toBeGreaterThanOrEqual(148);
  expect(prizeFontSize).toBeGreaterThanOrEqual(34);
  await expect(page.locator('.campaign-draw-badge')).not.toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.campaign-pill')).toContainText('Record it. Prove it.');
  await expect(page.locator('.campaign-headline-chip')).toHaveCSS(
    'background-color',
    'rgb(243, 137, 28)',
  );
  await expect(page.locator('.campaign-cta')).toBeHidden();
  await expect(page.locator('.quote-panel')).toHaveCSS('background-color', 'rgb(1, 34, 139)');
  await expect(page.getByText('Full name', { exact: true })).toBeVisible();
  await expect(page.getByText('South African mobile number', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
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
test('highlights an invalid phone field on mobile and logs its reason without sending the lead', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByLabel('Full name', { exact: true }).fill('Test Testing');
  await page.getByLabel('South African mobile number').fill('123');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.locator('#phone-error')).toBeVisible();
  const phoneField = page.locator('#phone').locator('xpath=../..');
  await expect(phoneField).toHaveClass(/field-invalid/);
  await expect(phoneField).toHaveCSS('animation-name', 'field-wiggle');
  await expect(phoneField).toHaveCSS('animation-duration', '0.6s');
  await expect(phoneField).toHaveCSS('border-top-color', 'rgb(179, 38, 30)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(phoneField).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#phone-error')).toBeVisible();
  await expect
    .poll(() => analytics.find((event) => event.event === 'form_validation_failed'))
    .toMatchObject({
      event: 'form_validation_failed',
      failures: [{ field: 'mobile', reason: 'format' }],
    });
  expect(leadRequests).toBe(0);
});
async function fillContact(page: import('@playwright/test').Page) {
  await page.getByLabel('Full name', { exact: true }).fill('Test Testing');
  await page.getByLabel('South African mobile number').fill('0821234567');
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
      email: 'person@example.com',
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
  await page.locator('#email').fill('person@example.com');
  await expect(page.locator('#email')).toHaveValue('person@example.com');
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
  await page.locator('#email').fill('person@example.com');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(1);
});

test('accepts a lead without email and omits the optional email from the request', async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        state: 'success',
        message: 'Accepted',
        diagnostics: { code: 'LEAD_RECEIVED' },
      },
    });
  });

  await page.goto('/');
  await fillContact(page);
  const email = page.getByLabel('Email address (optional)');
  await expect(email).not.toHaveAttribute('required', '');
  await expect(email).toHaveValue('');
  await page.getByRole('button', { name: 'Get Quote & Qualify' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(submittedBody).not.toHaveProperty('email');
});

test('describes an unconfirmed request accurately and reuses its idempotency key on retry', async ({
  page,
}) => {
  const submissionIds: string[] = [];
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    submissionIds.push(route.request().postDataJSON().submissionId);
    if (requests === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({
      json: {
        state: 'success',
        message: 'Accepted',
        diagnostics: { code: 'LEAD_RECEIVED' },
      },
    });
  });

  await page.goto('/');
  await fillContact(page);
  const submit = page.getByRole('button', { name: 'Get Quote & Qualify' });
  await submit.click();
  await expect(page.getByRole('status')).toContainText(
    'Your request may still have been received. Please wait a moment before trying again.',
  );
  await expect(page.getByRole('status')).not.toContainText('Check your connection');
  await submit.click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(2);
  expect(submissionIds[1]).toBe(submissionIds[0]);
});

test('single-step form requires a name', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByLabel('Full name', { exact: true }).fill('');
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
