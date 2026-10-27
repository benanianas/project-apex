import { expect, test, type Page } from '@playwright/test';
import { makeBoxingProgram, readinessExercises } from '../../src/data/boxing';
import { originalExercises } from '../../src/data/exercises';
import { dateKey, newSet, now, type Session } from '../../src/domain/model';
import { toKg } from '../../src/domain/calculations';
const nav = async (page: Page, label: string) => {
  if (await page.locator('.screen-workout').count())
    await page.getByRole('button', { name: 'Back to Today', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: label, exact: true })
    .click();
};
const open = async (page: Page) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
};
async function putSession(page: Page, record: Session) {
  await page.evaluate(async (record) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('project-apex');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('sessions', 'readwrite');
      transaction.objectStore('sessions').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, record);
}
function fixture(): Session {
  const p = makeBoxingProgram();
  return {
    id: crypto.randomUUID(),
    programId: p.id,
    dayId: p.days[0].id,
    daySnapshot: p.days[0],
    historyProgramId: p.id,
    title: p.days[0].title,
    kind: 'strength',
    date: dateKey(),
    startedAt: now(),
    finishedAt: null,
    status: 'draft',
    warmup: p.days[0].warmup,
    mobility: [],
    checklist: {},
    notes: 'Browser-test fixture',
    updatedAt: now(),
    performances: p.days[0].exercises.map((rx) => ({
      id: crypto.randomUUID(),
      exercise: structuredClone(
        [...originalExercises, ...readinessExercises].find((e) => e.id === rx.exerciseId)!,
      ),
      prescription: rx,
      sets: Array.from({ length: rx.sets }, newSet),
    })),
  };
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { errors: string[] }).errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test('new default program presents mandatory first, optional second and a rest day without obligations', async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByText('Project APEX: Boxing Readiness', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Full-body strength + power', exact: true }),
  ).toBeVisible();
  const start = await page
    .getByRole('button', { name: 'Start workout', exact: true })
    .boundingBox();
  const tabs = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
  expect(start!.y + start!.height).toBeLessThan(tabs!.y);
  await expect(page.locator('.day-priority-counts')).toHaveText('5 mandatory · 3 optional');
  await expect(page.locator('.exercise-row').first()).toContainText('Squat');
  await expect(page.locator('.exercise-row').nth(5)).toContainText('Optional');
  await page
    .getByRole('button', { name: 'Day 3: Athletic strength + hypertrophy', exact: true })
    .click();
  await expect(page.locator('.day-priority-counts')).toHaveText('5 mandatory · 5 optional');
  await page.getByRole('button', { name: 'Day 4: Mobility + recovery', exact: true }).click();
  await expect(page.locator('.day-priority-counts')).toHaveText('5 mandatory · 4 optional');
  await page.getByRole('button', { name: 'Day 7: Complete rest', exact: true }).click();
  await expect(page.locator('.day-priority-counts')).toHaveText('0 mandatory · 1 optional');
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toHaveCount(0);
});

test('skipping mandatory work records a reason and finishes honestly as partial', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const card = page.locator('.exercise-log:visible');
  await card.getByRole('button', { name: 'Skip exercise', exact: true }).click();
  await page.getByLabel('Skip reason / notes', { exact: true }).fill('Not recovered today');
  await page.getByRole('button', { name: 'Save skip', exact: true }).click();
  await expect(card.getByText(/Skipped: Not recovered today/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: /Full-body strength \+ power.*Essential work partially completed/,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: /Full-body strength \+ power.*Essential work partially completed/,
    })
    .click();
  await expect(page.locator('.exercise-log').first()).toContainText('Not recovered today');
});

test('essential work completes with all optional sets untouched', async ({ page }) => {
  await open(page);
  const s = fixture();
  for (const p of s.performances.filter((p) => p.prescription.priority === 'mandatory'))
    for (const set of p.sets)
      Object.assign(set, { done: true, loadKg: 20, reps: p.prescription.min, rir: 2 });
  await putSession(page, s);
  await page.reload();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(
    page.getByText('Essential work complete. Optional work is your choice.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Workout priorities')).toContainText('0/3');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Full-body strength \+ power.*Essential work complete/ }),
  ).toBeVisible();
});

test('previous sets show date, per-hand pounds and unknown RIR, including after a substitution', async ({
  page,
}) => {
  await open(page);
  const s = fixture();
  s.status = 'completed';
  s.finishedAt = now();
  s.dayId = 'different-training-day';
  const p = s.performances[2];
  s.performances = [p];
  p.sets = p.sets.map((set, i) => ({
    ...set,
    done: true,
    loadKg: toKg(65, 'lb'),
    reps: [12, 10, 7][i],
    rir: [2, null, 0][i],
  }));
  p.sets.push(
    { ...newSet(), done: true, loadKg: 10, reps: 10, warmup: true },
    { ...newSet(), loadKg: 100, reps: 3 },
  );
  await putSession(page, s);
  await page.reload();
  await nav(page, 'Settings');
  await page.getByRole('button', { name: /Training preferences Units/ }).click();
  await page.getByLabel('Resistance unit', { exact: true }).selectOption('lb');
  await nav(page, 'Today');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page
    .getByLabel('Current exercise', { exact: true })
    .selectOption({ label: '3. Incline dumbbell press' });
  const card = page.locator('.exercise-log:visible');
  const table = card.getByRole('table', { name: 'Previous Incline dumbbell press sets' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('cell', { name: '65 lb/hand', exact: true })).toHaveCount(3);
  await expect(table.getByRole('cell', { name: '—', exact: true })).toHaveCount(1);
  await expect(table.getByRole('cell', { name: '0', exact: true })).toHaveCount(1);
  await expect(card.locator('.previous-performance time')).toHaveAttribute('dateTime', dateKey());
  await expect(card.locator('.previous-advice')).not.toContainText(
    'Consider a small load increase',
  );
  await card.getByText('Change this exercise for this session', { exact: true }).click();
  await card
    .getByLabel('Replace Incline dumbbell press', { exact: true })
    .selectOption('flat-db-press');
  await expect(card.getByText('No previous performance recorded.', { exact: true })).toBeVisible();
  await card
    .getByLabel('Replace Flat dumbbell press', { exact: true })
    .selectOption('incline-db-press');
  await expect(table).toBeVisible();
  await card
    .getByLabel('Machine / equipment label (optional)', { exact: true })
    .fill('Different bench');
  await expect(card.getByText('No previous performance recorded.', { exact: true })).toBeVisible();
});

test('controlled intervals require phase approval and log actual rounds separately from steady cardio', async ({
  page,
}) => {
  await open(page);
  await nav(page, 'Program');
  await expect(page.getByLabel('Enable controlled Day 6 bike / rower intervals')).toBeDisabled();
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByLabel('Program start date', { exact: true }).fill('2026-09-01');
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await page.getByLabel('Enable controlled Day 6 bike / rower intervals').click();
  await expect(page.getByLabel('Enable controlled Day 6 bike / rower intervals')).toBeChecked();
  await nav(page, 'Today');
  await page.getByRole('button', { name: 'Day 6: Conditioning + jump rope', exact: true }).click();
  await expect(page.getByText(/6 × 1 min bike or rower efforts/)).toBeVisible();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Log cardio', exact: true }).click();
  await expect(page.getByLabel('Conditioning format')).toHaveValue('intervals');
  await page.getByLabel('Duration (minutes)', { exact: true }).fill('16');
  await page.getByLabel('RPE (1–10)', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save cardio', exact: true }).click();
  await page.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
  await page.getByRole('button', { name: 'Mark complete', exact: true }).first().click();
  await expect(
    page.getByText('Essential work complete. Optional work is your choice.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm finish', exact: true }).click();
  await page.getByRole('button', { name: 'Cardio', exact: true }).click();
  await page.getByLabel('Cardio modality', { exact: true }).selectOption('Cycling');
  await page.getByLabel('Cardio format', { exact: true }).selectOption('intervals');
  await expect(page.getByRole('img', { name: /^minutes\. 1 records\. Latest: 16/ })).toBeVisible();
});

test('editing priorities keeps the active session snapshot and affects only new sessions', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to Today', exact: true })).toBeVisible();
  await nav(page, 'Program');
  await page.getByRole('button', { name: 'Edit program', exact: true }).click();
  await page.getByLabel('Exercise priority', { exact: true }).first().selectOption('optional');
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await nav(page, 'Today');
  await expect(page.getByText('4 mandatory · 4 optional', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByLabel('Workout priorities')).toContainText('0/5');
  await expect(page.locator('.exercise-log:visible > .priority-badge')).toHaveText('Mandatory');
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.getByRole('button', { name: 'Discard workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByLabel('Workout priorities')).toContainText('0/4');
  await expect(page.locator('.exercise-log:visible')).toContainText('Lat pulldown');
});

test('single exercise logging saves a skip reason without inventing completed sets', async ({
  page,
}) => {
  await open(page);
  await page.goto('./#exercise/incline-db-press');
  await page.getByRole('button', { name: 'Skip exercise', exact: true }).click();
  await page
    .getByLabel('Reason for skipping', { exact: true })
    .selectOption('Equipment unavailable');
  await page.getByRole('button', { name: 'Save skip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /Incline dumbbell press.*completed/ }).click();
  await expect(page.getByLabel('Workout priorities')).toContainText('0/1');
  await expect(page.locator('.exercise-log:visible')).toContainText('Equipment unavailable');
});
