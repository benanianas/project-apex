import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import {
  ApexDB,
  clearPersonalData,
  createSession,
  discardDraftSession,
  removeSession,
  restoreOriginal,
  saveSession,
  seed,
} from '../src/storage/db';
import {
  backupSchema,
  createBackup,
  csv,
  exportCsv,
  importBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
} from '../src/storage/backup';
import { defaultSettings, makeOriginalProgram } from '../src/data/program';
import { originalExercises } from '../src/data/exercises';
import { now } from '../src/domain/model';
let database: ApexDB;
beforeEach(async () => {
  database = new ApexDB(`test-${crypto.randomUUID()}`);
  await seed(database);
});
afterEach(async () => {
  await database.delete();
});
describe('persistent sessions and snapshots', () => {
  it('seeds once even with repeated or concurrent startup', async () => {
    await Promise.all([seed(database), seed(database)]);
    expect(await database.programs.count()).toBe(1);
    expect(await database.exercises.count()).toBe(originalExercises.length);
  });
  it('creates a full draft, persists edited sets, and reloads it', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    expect(s.performances).toHaveLength(9);
    expect(s.performances.flatMap((p) => p.sets)).toHaveLength(23);
    s.performances[0].sets[0] = { ...s.performances[0].sets[0], reps: 7, done: true, rir: 2 };
    await saveSession(s, database);
    database.close();
    await database.open();
    expect((await database.sessions.get(s.id))?.performances[0].sets[0].reps).toBe(7);
    s.performances[0].sets[0].reps = 8;
    await saveSession(s, database);
    expect((await database.sessions.get(s.id))?.performances[0].sets[0].reps).toBe(8);
  });
  it('keeps historical prescriptions after edits and original restoration', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    p.days[0].exercises[0].sets = 5;
    p.days[0].title = 'Changed';
    await database.programs.put(p);
    await restoreOriginal(database);
    const historical = await database.sessions.get(s.id);
    expect(historical?.title).toBe('Full Body A');
    expect(historical?.performances[0].prescription.sets).toBe(3);
    expect(await database.sessions.count()).toBe(1);
    expect(await database.programs.count()).toBe(2);
  });
  it('prefills only previously completed comparable performances, without marking them done', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    s.status = 'completed';
    s.finishedAt = now();
    s.performances[1].sets[0] = {
      ...s.performances[1].sets[0],
      loadKg: 22.5,
      reps: 9,
      rir: 2,
      done: true,
    };
    await saveSession(s, database);
    const next = await createSession(p, p.days[0], database);
    expect(next.performances[1].sets[0]).toMatchObject({
      loadKg: 22.5,
      reps: 9,
      done: false,
      rir: null,
    });
  });
  it('rejects invalid completed data without overwriting saved records', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    s.performances[0].sets[0].done = true;
    await expect(saveSession(s, database)).rejects.toThrow(/repetitions/);
    expect((await database.sessions.get(s.id))?.performances[0].sets[0].done).toBe(false);
  });
  it('looks up shared exercise identities and retains history on archive', async () => {
    const exercise = await database.exercises.get('biceps-curl');
    expect(exercise?.name).toBe('Biceps curl');
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    await database.exercises.update('biceps-curl', { archived: true });
    expect((await database.sessions.get(s.id))?.performances[6].exercise.archived).toBe(false);
  });
  it('cascades explicit session deletion only to linked records', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[1], database);
    await database.drafts.put({
      id: `cardio-${s.id}`,
      fields: { minutes: '12' },
      updatedAt: now(),
    });
    await removeSession(s.id, database);
    expect(await database.sessions.count()).toBe(0);
    expect(await database.drafts.count()).toBe(0);
    expect(await database.exercises.count()).toBe(originalExercises.length);
  });
});
describe('canceling unfinished workouts', () => {
  it('discards only the selected draft and linked activities, drafts and timer state', async () => {
    const p = makeOriginalProgram();
    const canceled = await createSession(p, p.days[1], database);
    const other = await createSession(p, p.days[0], database);
    await database.settings.update('settings', { weightUnit: 'lb' });
    const cardio = {
      id: 'linked-cardio',
      sessionId: canceled.id,
      date: canceled.date,
      activity: 'Treadmill running',
      minutes: 30,
      speedKmh: null,
      distanceKm: null,
      incline: null,
      rpe: 4,
      heartRate: null,
      notes: '',
      completed: true,
      updatedAt: now(),
    };
    const rope = {
      id: 'linked-rope',
      sessionId: canceled.id,
      date: canceled.date,
      rounds: 5,
      workSeconds: 30,
      restSeconds: 60,
      elapsedSeconds: null,
      rpe: null,
      tolerance: 'good' as const,
      notes: '',
      completed: true,
      updatedAt: now(),
    };
    await database.cardio.bulkPut([cardio, { ...cardio, id: 'unlinked-cardio', sessionId: null }]);
    await database.rope.bulkPut([rope, { ...rope, id: 'other-rope', sessionId: other.id }]);
    await database.drafts.bulkPut(
      [
        `cardio-${canceled.id}`,
        `rope-${canceled.id}`,
        'cardio-edit-linked-cardio',
        'rope-edit-linked-rope',
        'cardio-new',
      ].map((id) => ({ id, fields: { notes: 'draft' }, updatedAt: now() })),
    );
    await database.timers.put({
      id: 'rest',
      duration: 180,
      remaining: 180,
      endAt: Date.now() + 180000,
    });
    await discardDraftSession(canceled.id, database);
    expect(await database.sessions.get(canceled.id)).toBeUndefined();
    expect(await database.sessions.get(other.id)).toEqual(other);
    expect((await database.cardio.toArray()).map((c) => c.id)).toEqual(['unlinked-cardio']);
    expect((await database.rope.toArray()).map((r) => r.id)).toEqual(['other-rope']);
    expect((await database.drafts.toArray()).map((d) => d.id)).toEqual(['cardio-new']);
    expect(await database.timers.get('rest')).toMatchObject({ endAt: null, remaining: 180 });
    expect((await database.settings.get('settings'))?.weightUnit).toBe('lb');
    expect(await database.programs.count()).toBe(1);
  });
  it('refuses to cancel completed history', async () => {
    const p = makeOriginalProgram();
    const session = await createSession(p, p.days[0], database);
    await saveSession({ ...session, status: 'completed', finishedAt: now() }, database);
    await expect(discardDraftSession(session.id, database)).rejects.toThrow('already completed');
    expect((await database.sessions.get(session.id))?.status).toBe('completed');
  });
  it('rolls back deletion if resetting the timer fails', async () => {
    const p = makeOriginalProgram();
    const session = await createSession(p, p.days[0], database);
    await database.drafts.put({
      id: `cardio-${session.id}`,
      fields: { minutes: '12' },
      updatedAt: now(),
    });
    await database.timers.put({
      id: 'rest',
      duration: 120,
      remaining: 120,
      endAt: Date.now() + 120000,
    });
    database.timers.hook('updating', () => {
      throw new Error('Simulated write failure');
    });
    await expect(discardDraftSession(session.id, database)).rejects.toThrow(
      'Simulated write failure',
    );
    expect(await database.sessions.get(session.id)).toEqual(session);
    expect(await database.drafts.get(`cardio-${session.id}`)).toBeDefined();
    expect((await database.timers.get('rest'))?.endAt).not.toBeNull();
  });
});
describe('complete, validated backup restoration', () => {
  it('roundtrips records, preferences, drafts and active timer transactionally', async () => {
    const p = makeOriginalProgram();
    await createSession(p, p.days[0], database);
    await database.settings.update('settings', { weightUnit: 'lb' });
    await database.drafts.put({ id: 'cardio-new', fields: { minutes: '35' }, updatedAt: now() });
    await database.timers.put({
      id: 'rest',
      duration: 120,
      remaining: 120,
      endAt: Date.now() + 120000,
    });
    const b = await createBackup(database);
    expect(backupSchema.safeParse(b).success).toBe(true);
    await clearPersonalData(database);
    await importBackup(parseBackup(JSON.stringify(b)), 'replace', database);
    expect(await database.sessions.count()).toBe(1);
    expect((await database.settings.get('settings'))?.weightUnit).toBe('lb');
    expect((await database.drafts.get('cardio-new'))?.fields.minutes).toBe('35');
    expect(await database.timers.count()).toBe(1);
  });
  it('merges idempotently, keeps existing IDs and settings', async () => {
    const p = makeOriginalProgram();
    const s = await createSession(p, p.days[0], database);
    const b = await createBackup(database);
    b.data.sessions[0].title = 'Old title';
    b.data.settings.weightUnit = 'lb';
    const first = await importBackup(b, 'merge', database);
    const second = await importBackup(b, 'merge', database);
    expect(first.added).toBe(0);
    expect(second.added).toBe(0);
    expect((await database.sessions.get(s.id))?.title).toBe('Full Body A');
    expect((await database.settings.get('settings'))?.weightUnit).toBe('kg');
  });
  it('migrates a version 1 backup without losing records', async () => {
    const b = await createBackup(database);
    const v1 = { ...b, version: 1, data: { ...b.data, drafts: undefined, timers: undefined } };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.version).toBe(2);
    expect(parsed.data.exercises).toHaveLength(originalExercises.length);
    expect(parsed.data.drafts).toEqual([]);
  });
  it('rejects malformed, oversized, duplicate, future and dangling records', async () => {
    expect(() => parseBackup('bad')).toThrow(/JSON/);
    expect(() => parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1))).toThrow(/20 MB/);
    const b = await createBackup(database);
    expect(() => parseBackup(JSON.stringify({ ...b, version: 999 }))).toThrow(/incompatible/);
    const duplicate = structuredClone(b);
    duplicate.data.exercises.push(duplicate.data.exercises[0]);
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow(/Duplicate/);
    const missing = structuredClone(b);
    missing.data.exercises = missing.data.exercises.filter((e) => e.id !== 'pull-up');
    expect(() => parseBackup(JSON.stringify(missing))).toThrow(/absent exercise/);
  });
  it('rejects invalid replace before clearing any existing data', async () => {
    const b = await createBackup(database);
    b.data.programs[0].days[0].exercises[0].sets = -1;
    await expect(importBackup(b, 'replace', database)).rejects.toThrow();
    expect(await database.programs.count()).toBe(1);
    expect(await database.exercises.count()).toBe(originalExercises.length);
  });
  it('rolls back an import if a database write fails mid-transaction', async () => {
    const b = await createBackup(database);
    const fail = () => {
      throw new Error('simulated storage failure');
    };
    database.sessions.hook('creating', fail);
    const p = makeOriginalProgram();
    const source = new ApexDB(`source-${crypto.randomUUID()}`);
    await seed(source);
    const s = await createSession(p, p.days[0], source);
    b.data.sessions.push(s);
    b.data.settings.weightUnit = 'lb';
    await expect(importBackup(b, 'replace', database)).rejects.toThrow(/simulated/);
    expect((await database.settings.get('settings'))?.weightUnit).toBe('kg');
    expect(await database.exercises.count()).toBe(originalExercises.length);
    database.sessions.hook('creating').unsubscribe(fail);
    await source.delete();
  });
  it('quotes CSV cells, preserves dates and neutralizes spreadsheet formula injection', async () => {
    expect(csv([['a,b', '"quoted"', '=HYPERLINK("bad")', 2, null]])).toContain(
      '"a,b","""quoted""","\'=HYPERLINK(""bad"")","2",""',
    );
    const p = makeOriginalProgram();
    await createSession(p, p.days[0], database);
    const output = await exportCsv('sets', database);
    expect(output).toContain('load_kg_per_implement');
    expect(output).toContain('reps_per_side');
    expect(output).not.toContain('Full Body A');
    expect(await exportCsv('sessions', database)).toContain('Full Body A');
  });
});
it('upgrades an existing v1 IndexedDB database non-destructively', async () => {
  const name = `legacy-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    exercises: 'id,name,primary,archived',
    programs: 'id',
    sessions: 'id,date,status,dayId,programId',
    cardio: 'id,date,sessionId',
    rope: 'id,date,sessionId',
    settings: 'id',
    timers: 'id',
  });
  await old.table('settings').put({ ...defaultSettings(), weightUnit: 'lb' });
  await old.table('programs').put(makeOriginalProgram());
  old.close();
  const upgraded = new ApexDB(name);
  await upgraded.open();
  expect((await upgraded.settings.get('settings'))?.weightUnit).toBe('lb');
  expect(await upgraded.programs.count()).toBe(1);
  expect(await upgraded.drafts.count()).toBe(0);
  await upgraded.delete();
});
