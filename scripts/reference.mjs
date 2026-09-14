import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('https://xsendr.com/landing/Cartrack', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/reference-desktop.png', fullPage: true });
console.log(await page.locator('body').innerText());
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'artifacts/reference-mobile.png', fullPage: true });
await fs.writeFile(
  'artifacts/reference-fonts.json',
  JSON.stringify(await page.evaluate(() => [...document.styleSheets].map((s) => s.href)), null, 2),
);
await browser.close();
