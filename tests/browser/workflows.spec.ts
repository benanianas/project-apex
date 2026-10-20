import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const navigate = async (page: Page, label: string) => {
  if (await page.locator('.screen-workout').count())
    await page.getByRole('button', { name: 'Back to Today', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: label, exact: true })
    .click();
};
async function openApp(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}
async function startStrength(page: Page) {
  await page.getByRole('button', { name: 'Day 1: Full Body A', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.locator('.exercise-log')).toHaveCount(9);
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  test.info().annotations.push({
    type: 'runtime-check',
    description: 'Unhandled page errors checked after each test',
  });
  (page as Page & { apexErrors: string[] }).apexErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { apexErrors: string[] }).apexErrors).toEqual([]);
});
test('mobile navigation, original prescriptions, rest/recovery and local guides', async ({
  page,
}) => {
  await openApp(page);
  await expect(page.locator('.exercise-row')).toHaveCount(9);
  await expect(page.getByText('23 working sets', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Day 3: Full Body B', exact: true }).click();
  await expect(page.locator('.exercise-row')).toHaveCount(10);
  await page.getByRole('button', { name: 'Day 7: Complete Rest', exact: true }).click();
  await expect(page.getByText('Nothing to tick off today.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Day 4: Active Recovery', exact: true }).click();
  await page.getByRole('button', { name: 'Start mobility' }).click();
  await page
    .getByRole('button', {
      name: 'Complete Knee-to-wall ankle mobilization — 2 × 10 per side',
      exact: true,
    })
    .click();
  await expect(page.getByText('Saved on device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Uncheck Knee-to-wall ankle mobilization — 2 × 10 per side' }),
  ).toBeVisible();
  await navigate(page, 'Exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Romanian');
  await page.locator('.library-card').click();
  await expect(page.getByRole('heading', { name: 'Romanian deadlift', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Exercise info Technique/ }).click();
  await expect(page.getByRole('heading', { name: 'How to perform' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Romanian deadlift:/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('strength draft reload, immediate set save, volume, undo, timer, finish and chart', async ({
  page,
}) => {
  await openApp(page);
  await startStrength(page);
  const pull = page.locator('.exercise-log').nth(0);
  await pull.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }).fill('7');
  await pull.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
  const press = page.locator('.exercise-log').nth(1);
  await press.getByRole('spinbutton', { name: 'Set 1 weight', exact: true }).fill('20');
  await press.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }).fill('10');
  await press.getByRole('spinbutton', { name: 'Set 1 RIR', exact: true }).fill('2');
  await press.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await expect(press.getByText('400 kg·reps', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved on device', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
  await expect(
    page
      .locator('.exercise-log')
      .nth(1)
      .getByRole('spinbutton', { name: 'Set 1 weight', exact: true }),
  ).toHaveValue('20');
  await page.getByRole('button', { name: 'Previous exercise', exact: true }).click();
  await expect(
    page
      .locator('.exercise-log')
      .nth(0)
      .getByRole('button', { name: 'Uncomplete set 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const first = page.locator('.exercise-log').first();
  await first.locator('.set-details').first().getByText('Set options', { exact: false }).click();
  await first.getByRole('button', { name: 'Remove set', exact: true }).first().click();
  await expect(first.locator('.set-entry')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo deletion' }).click();
  await expect(first.locator('.set-entry')).toHaveCount(3);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause rest', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pause rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause rest', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await navigate(page, 'Exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Incline dumbbell');
  await page.locator('.library-card').click();
  await expect(page.getByRole('img', { name: /Volume. 1 records/ })).toBeVisible();
  await page.getByText('View chart values', { exact: true }).click();
  await expect(page.getByRole('cell', { name: '400', exact: true })).toBeVisible();
});
test('cardio, rope, draft restoration and comparable charts', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Day 2: Aerobic Conditioning', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Log cardio', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('32');
  await page.getByRole('spinbutton', { name: 'Average speed (mph)', exact: true }).fill('6');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Log cardio', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }),
  ).toHaveValue('32');
  await page.getByRole('spinbutton', { name: 'RPE (1–10)', exact: true }).fill('4');
  await expect(page.getByText(/Calculated distance: 3.2 mi/)).toBeVisible();
  await page.getByRole('button', { name: 'Save cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Log jump rope', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Rounds completed', exact: true }).fill('5');
  await page.getByLabel('Calf, shin, ankle & Achilles tolerance').selectOption('good');
  await expect(page.getByText('Active rope time: 2.5 min · Rest excluded')).toBeVisible();
  await page.getByRole('button', { name: 'Save jump rope', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish', exact: true }).click();
  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await expect(page.getByRole('img', { name: /^minutes. 1 records/ })).toBeVisible();
  await page.getByRole('button', { name: 'Jump rope', exact: true }).click();
  await expect(
    page.getByRole('img', { name: /Active rope time. 1 records. Latest: 2.5/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /Treadmill running/ }).click();
  await page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('35');
  await page.getByRole('button', { name: 'Save cardio', exact: true }).click();
  await expect(page.getByText(/35 min · Completed/)).toBeVisible();
});
test('JSON download, validated merge, explicit replace and CSV', async ({ page }) => {
  await openApp(page);
  await startStrength(page);
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true })
    .fill('8');
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('button', { name: 'Complete set 1', exact: true })
    .click();
  await expect(page.getByText('Saved on device', { exact: true })).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Backup & Restore Keep a copy/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export complete backup', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^project-apex-backup-.*\.json$/);
  const buffer = await readFile((await file.path())!);
  const backup = JSON.parse(buffer.toString());
  expect(backup.data.sessions).toHaveLength(1);
  expect(backup.data.sessions[0].performances[0].sets[0].reps).toBe(8);
  await page
    .getByLabel('Import a JSON backup')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('0 records imported');
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Local storage Persistence/ }).click();
  await page.getByRole('button', { name: 'Clear personal data', exact: true }).click();
  await page.getByLabel('Type DELETE ALL to confirm').fill('DELETE ALL');
  await page.getByRole('button', { name: 'Delete all personal data', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Backup & Restore Keep a copy/ }).click();
  await page
    .getByLabel('Import a JSON backup')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await page.getByLabel('Import mode').selectOption('replace');
  await expect(
    page.getByRole('button', { name: 'Replace all data from backup', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Type REPLACE to confirm replacing all local data').fill('REPLACE');
  await page.getByRole('button', { name: 'Replace all data from backup', exact: true }).click();
  await navigate(page, 'Today');
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page
      .locator('.exercise-log')
      .first()
      .getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }),
  ).toHaveValue('8');
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Backup & Restore Keep a copy/ }).click();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Strength sets CSV', exact: true }).click();
  const csvFile = await csv;
  expect(await readFile((await csvFile.path())!, 'utf8')).toContain('load_kg_per_implement');
  await page.getByLabel('Import a JSON backup').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('status')).toContainText('not valid JSON');
});
test('installed shell, lazy guides and tracking remain available offline', async ({
  page,
  context,
}) => {
  await openApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await page.request.get('manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const m = await manifest.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await startStrength(page);
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true })
    .fill('6');
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('button', { name: 'Complete set 1', exact: true })
    .click();
  await expect(page.getByText('Saved on device', { exact: true })).toBeVisible();
  await navigate(page, 'Exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Farmer carry');
  await page.locator('.library-card').click();
  await page.getByRole('button', { name: /Exercise info Technique/ }).click();
  await expect(page.getByRole('heading', { name: 'How to perform' })).toBeVisible();
  await navigate(page, 'Progress');
  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Log cardio', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Save cardio', exact: true }).click();
  await expect(page.getByRole('img', { name: /^minutes. 1 records/ })).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Backup & Restore Keep a copy/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export complete backup', exact: true }).click();
  const file = await download;
  expect(JSON.parse(await readFile((await file.path())!, 'utf8')).data.cardio).toHaveLength(1);
  await context.setOffline(false);
  await page.reload();
  await navigate(page, 'Today');
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page
      .locator('.exercise-log')
      .first()
      .getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }),
  ).toHaveValue('6');
});
test('program changes preserve snapshots and restoration preserves history', async ({ page }) => {
  await openApp(page);
  await startStrength(page);
  await navigate(page, 'Program');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByRole('textbox', { name: 'Workout title', exact: true }).fill('Custom strength A');
  await page.getByRole('spinbutton', { name: 'Sets', exact: true }).first().fill('4');
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await navigate(page, 'Today');
  await expect(page.getByRole('heading', { name: 'Custom strength A', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Full Body A', exact: true })).toBeVisible();
  await expect(page.locator('.exercise-log').first().locator('.set-entry')).toHaveCount(3);
  await navigate(page, 'Program');
  await page.getByRole('button', { name: 'Restore original APEX', exact: true }).click();
  await page.getByRole('button', { name: 'Restore original program', exact: true }).click();
  await navigate(page, 'Progress');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Full Body A/ })).toBeVisible();
});
test('custom exercise creation, units and responsive layouts', async ({ page }) => {
  await openApp(page);
  await navigate(page, 'Exercises');
  await page.getByRole('button', { name: 'New exercise', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Exercise name', exact: true })
    .fill('Test suitcase carry');
  await page.getByRole('textbox', { name: 'Primary muscle', exact: true }).fill('Trunk');
  await page.getByRole('textbox', { name: 'Equipment', exact: true }).fill('Dumbbell');
  await page.getByLabel('Logging type', { exact: true }).selectOption('carry');
  await page
    .getByLabel('Instructions · one per line')
    .fill('Stand tall with a weight in one hand.\nWalk with control.\nSet it down safely.');
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Test suitcase');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.locator('.library-card').click();
  await expect(
    page.getByRole('heading', { name: 'Test suitcase carry', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Training preferences Units/ }).click();
  await page.getByLabel('Resistance unit', { exact: true }).selectOption('lb');
  await page.reload();
  await expect(page.getByLabel('Resistance unit', { exact: true })).toHaveValue('lb');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#today');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('exercise page starts with logging, shares workout sets and separates the guide', async ({
  page,
}) => {
  await openApp(page);
  await startStrength(page);
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('button', { name: /^Pull-up/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Log sets', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How to perform' })).toHaveCount(0);
  const position = await page.evaluate(() => ({
    log: document.querySelector('.exercise-inline-log')!.getBoundingClientRect().top,
    progress: [...document.querySelectorAll('h2')]
      .find((el) => el.textContent === 'Your progress')!
      .getBoundingClientRect().top,
    info: document.querySelector('.exercise-info-link')!.getBoundingClientRect().top,
  }));
  expect(position.log).toBeLessThan(position.progress);
  expect(position.progress).toBeLessThan(position.info);
  await page.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }).fill('8');
  await page.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await expect(page.getByText('Saved on device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }),
  ).toHaveValue('8');
  await page.getByRole('button', { name: 'Open workout', exact: true }).click();
  await expect(
    page
      .locator('.exercise-log')
      .first()
      .getByRole('button', { name: 'Uncomplete set 1', exact: true }),
  ).toBeVisible();
  await page
    .locator('.exercise-log')
    .first()
    .getByRole('button', { name: /^Pull-up/ })
    .click();
  await page.getByRole('button', { name: /Exercise info Technique/ }).click();
  await expect(page.getByRole('heading', { name: 'How to perform' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Log sets' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to logging', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }),
  ).toHaveValue('8');
});

test('individual exercise logging finishes without marking a full program day complete', async ({
  page,
}) => {
  await openApp(page);
  await page.locator('.exercise-row').first().click();
  await expect(page.getByText('Single-exercise session', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true }).fill('6');
  await page.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await navigate(page, 'Exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Pull-up');
  await page.getByRole('button', { name: 'Open Pull-up', exact: true }).click();
  await expect(
    page.getByRole('img', { name: /Total repetitions. 1 records. Latest: 6/ }),
  ).toBeVisible();
  await navigate(page, 'Today');
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
});

test('iPhone full-screen safe areas keep navigation and workout actions reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openApp(page);
  // Representative installed-app insets. Real iOS env() values require device QA.
  await page.addStyleTag({ content: ':root { --safe-top: 62px; --safe-bottom: 34px; }' });
  const nav = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
  expect(nav).not.toBeNull();
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(840);
  await startStrength(page);
  const finish = await page
    .getByRole('button', { name: 'Finish workout', exact: true })
    .boundingBox();
  expect(finish!.y + finish!.height).toBeLessThanOrEqual(840);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Finish this session?' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('cancel workout confirms, keeps entries when dismissed, and discards without completion', async ({
  page,
  context,
}) => {
  await openApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await startStrength(page);
  const reps = page
    .locator('.exercise-log')
    .first()
    .getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true });
  await reps.fill('7');
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cancel this workout?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep workout', exact: true }).click();
  await expect(reps).toHaveValue('7');
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(0);
  await expect(page.locator('.resume-banner')).toHaveCount(0);
  await navigate(page, 'Progress');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Full Body A/ })).toHaveCount(0);
  await navigate(page, 'Today');
  await startStrength(page);
  await expect(reps).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Start rest', exact: true })).toBeVisible();
});

test('cancel conditioning removes saved cardio and unfinished rope entries', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Day 2: Aerobic Conditioning', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Log cardio', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Save cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Log jump rope', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Rounds completed', exact: true }).fill('5');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: /Backup & Restore Keep a copy/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export complete backup', exact: true }).click();
  const file = await download;
  const { data } = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(data.sessions).toEqual([]);
  expect(data.cardio).toEqual([]);
  expect(data.rope).toEqual([]);
  expect(data.drafts).toEqual([]);
});

test('individual exercise cancellation preserves a different active workout', async ({ page }) => {
  await openApp(page);
  await startStrength(page);
  await navigate(page, 'Exercises');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Farmer carry');
  await page.getByRole('button', { name: 'Open Farmer carry', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set 1 weight', exact: true }).fill('20');
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Full Body A', exact: true })).toBeVisible();
});
