import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const url = process.env.E2E_URL || 'http://localhost:4173/';
await mkdir('artifacts/screenshots', { recursive: true });
const browser = await chromium.launch();
for (const [name, options] of [
  ['desktop', { viewport: { width: 1440, height: 1100 } }],
  ['iphone', devices['iPhone 17 Pro']],
]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(url);
  await page.getByRole('heading', { name: 'Today' }).waitFor();
  await page.screenshot({ path: `artifacts/screenshots/${name}-today.png`, fullPage: true });
  if (name === 'iphone') {
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await page.locator('.exercise-log').first().waitFor();
    await page.screenshot({ path: 'artifacts/screenshots/iphone-workout.png', fullPage: false });
    await page
      .locator('.exercise-log')
      .first()
      .getByRole('button', { name: /^Pull-up/ })
      .click();
    await page.getByRole('heading', { name: 'Log sets', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/screenshots/iphone-exercise.png', fullPage: false });
    await page.getByRole('button', { name: /Exercise info Technique/ }).click();
    await page.getByRole('heading', { name: 'How to perform' }).waitFor();
    await page.screenshot({
      path: 'artifacts/screenshots/iphone-exercise-info.png',
      fullPage: false,
    });
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name: 'Settings', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/screenshots/iphone-settings.png', fullPage: true });
  }
  await context.close();
}
await browser.close();
