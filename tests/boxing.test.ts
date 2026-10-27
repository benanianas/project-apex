import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOXING_PROGRAM,
  BOXING_UPDATE,
  makeBoxingProgram,
  readinessExercises,
} from '../src/data/boxing';
import { originalExercises } from '../src/data/exercises';
import { makeOriginalProgram, defaultSettings } from '../src/data/program';
import {
  dateKey,
  cardioSchema,
  newSet,
  now,
  programSchema,
  type Performance,
  type Session,
} from '../src/domain/model';
import { effectiveDay, priorityOrder, sessionProgress, taskComplete } from '../src/domain/training';
import { currentSuggestion, previousPerformances } from '../src/domain/history';
import { workingSets, toKg } from '../src/domain/calculations';
import { ApexDB, createSession, saveSession, seed } from '../src/storage/db';
import { createBackup, importBackup, parseBackup } from '../src/storage/backup';
const program = () => makeBoxingProgram();
const perf = (patch: Partial<Performance> = {}): Performance => ({
  id: crypto.randomUUID(),
  exercise: structuredClone(originalExercises.find((e) => e.id === 'incline-db-press')!),
  prescription: program().days[0].exercises[2],
  sets: [
    { ...newSet(), done: true, loadKg: toKg(65, 'lb'), reps: 12, rir: 2 },
    { ...newSet(), done: true, loadKg: toKg(65, 'lb'), reps: 10, rir: null },
    { ...newSet(), done: true, loadKg: toKg(65, 'lb'), reps: 7, rir: 0 },
  ],
  ...patch,
});
const session = (p = perf(), patch: Partial<Session> = {}): Session => ({
  id: crypto.randomUUID(),
  programId: BOXING_PROGRAM,
  dayId: 'different-day',
  title: 'Earlier training',
  kind: 'strength',
  date: dateKey(),
  status: 'completed',
  startedAt: now(),
  finishedAt: now(),
  performances: [p],
  warmup: [],
  mobility: [],
  checklist: {},
  notes: '',
  updatedAt: now(),
  ...patch,
});
describe('Boxing Readiness prescriptions and priority logic', () => {
  it('matches all strength prescriptions, mandatory grouping and numbered days', () => {
    const p = program();
    expect(programSchema.safeParse(p).success).toBe(true);
    expect(p.days.map((d) => d.weekday)).toEqual(Array(7).fill(null));
    expect(
      p.days
        .filter((d) => d.kind === 'strength')
        .map((d) => [
          d.exercises.filter((x) => x.priority === 'mandatory').length,
          d.exercises.filter((x) => x.priority === 'optional').length,
          d.exercises.reduce((n, x) => n + x.sets, 0),
        ]),
    ).toEqual([
      [5, 3, 19],
      [5, 5, 22],
      [6, 3, 22],
    ]);
    expect(p.days[0].exercises.map((x) => [x.exerciseId, x.sets, x.min, x.max, x.rest])).toEqual([
      ['squat', 3, 5, 8, 180],
      ['lat-pulldown', 3, 8, 12, 120],
      ['incline-db-press', 3, 6, 10, 120],
      ['rdl', 2, 6, 10, 180],
      ['chest-row', 2, 8, 12, 90],
      ['cable-lateral-raise', 2, 12, 20, 60],
      ['barbell-curl', 2, 8, 12, 60],
      ['standing-calf', 2, 10, 15, 60],
    ]);
    const ids = new Set([...originalExercises, ...readinessExercises].map((e) => e.id));
    expect(
      p.days
        .flatMap((d) => d.exercises)
        .every((x) => ids.has(x.exerciseId) && x.alternatives.every((id) => ids.has(id))),
    ).toBe(true);
    expect(p.days[1].cardio).toMatchObject({ min: 30, max: 40, rpe: '3–4', speedMin: null });
    expect(p.days[3].tasks?.filter((t) => t.priority === 'mandatory')).toHaveLength(5);
    expect(p.days[6].tasks?.every((t) => t.priority === 'optional')).toBe(true);
  });
  it('keeps easy cardio and no jumps until both the phase and explicit approval allow them', () => {
    const p = program();
    p.startDate = '2026-10-01';
    p.readiness = { intervals: true, jumps: true };
    expect(effectiveDay(p, p.days[5], '2026-10-14').intervalActive).not.toBe(true);
    expect(effectiveDay(p, p.days[5], '2026-10-15')).toMatchObject({
      intervalActive: true,
      cardio: { min: 16 },
      intervalPlan: { rounds: 6, workSeconds: 60, recoverySeconds: 120 },
    });
    expect(effectiveDay(p, p.days[0], '2026-10-15').warmup.at(-1)).toContain('3 × 3');
    p.readiness.intervals = false;
    expect(effectiveDay(p, p.days[5], '2026-11-01').intervalActive).not.toBe(true);
    expect(p.days[0].warmup).toHaveLength(2);
  });
  it('keeps order within each priority and considers optional omissions successful', () => {
    expect(
      priorityOrder([
        { id: 1, priority: 'optional' as const },
        { id: 2, priority: 'mandatory' as const },
        { id: 3, priority: 'mandatory' as const },
      ]).map((x) => x.id),
    ).toEqual([2, 3, 1]);
    const mandatory = perf();
    const optional = perf({
      prescription: { ...mandatory.prescription, priority: 'optional' },
      sets: [],
    });
    const s = session(mandatory, { performances: [mandatory, optional] });
    expect(sessionProgress(s)).toMatchObject({
      mandatoryDone: 1,
      mandatory: 1,
      optionalDone: 0,
      essential: 'complete',
    });
    s.performances[0].skipped = { reason: 'Recovery', at: now() };
    expect(sessionProgress(s)).toMatchObject({
      mandatoryDone: 0,
      essential: 'partial',
      skipped: 1,
    });
  });
  it('requires actual interval work, not an unrelated steady duration, for interval completion', () => {
    const p = program();
    p.startDate = '2026-01-01';
    p.readiness = { intervals: true, jumps: false };
    const plan = effectiveDay(p, p.days[5]);
    const s = session(undefined, { performances: [], daySnapshot: plan });
    const c = {
      id: 'cardio',
      sessionId: s.id,
      date: dateKey(),
      activity: 'Cycling',
      minutes: 30,
      speedKmh: null,
      distanceKm: null,
      incline: null,
      rpe: 7,
      heartRate: null,
      notes: '',
      completed: true,
      updatedAt: now(),
    };
    expect(taskComplete(plan.tasks![1], s, [c], [])).toBe(false);
    expect(
      cardioSchema.safeParse({
        ...c,
        minutes: 1,
        intervals: { rounds: 6, workSeconds: 60, recoverySeconds: 120 },
      }).success,
    ).toBe(false);
    expect(sessionProgress(s, [c]).remainingMinutes).toBe(sessionProgress(s).remainingMinutes);
    expect(
      taskComplete(
        plan.tasks![1],
        s,
        [{ ...c, intervals: { rounds: 6, workSeconds: 60, recoverySeconds: 120 } }],
        [],
      ),
    ).toBe(true);
  });
  it('requires the prescribed rope work and does not count a shortened attempt as complete', () => {
    const plan = program().days[1];
    const s = session(undefined, { performances: [], daySnapshot: plan });
    const rope = {
      id: 'rope',
      sessionId: s.id,
      date: dateKey(),
      rounds: 2,
      workSeconds: 30,
      restSeconds: 60,
      elapsedSeconds: null,
      rpe: null,
      tolerance: 'unknown' as const,
      notes: '',
      completed: true,
      updatedAt: now(),
    };
    expect(taskComplete(plan.tasks![2], s, [], [rope])).toBe(false);
    expect(taskComplete(plan.tasks![2], s, [], [{ ...rope, rounds: 5 }])).toBe(true);
    expect(taskComplete(plan.tasks![2], s, [], [{ ...rope, rounds: 5, workSeconds: 10 }])).toBe(
      false,
    );
  });
});
describe('previous performance references', () => {
  it('resolves stable identities across days and retains every actual completed working set', () => {
    const p = perf();
    p.sets.push(
      { ...newSet(), done: true, loadKg: 10, reps: 10, warmup: true },
      { ...newSet(), done: false, loadKg: 30, reps: 5 },
      { ...newSet(), done: true },
    );
    const old = session(p);
    const draft = session(perf(), { status: 'draft', date: '2027-01-01' });
    const previous = previousPerformances(perf(), [old, draft]).at(-1)!;
    expect(previous.session.dayId).toBe('different-day');
    expect(workingSets(previous.performance).map((s) => [s.reps, s.rir])).toEqual([
      [12, 2],
      [10, null],
      [7, 0],
    ]);
    expect(currentSuggestion(perf(), [old], 'new', 2.5)?.nextKg).toBeUndefined();
  });
  it('separates substitutions, fresh-program history, load semantics and labeled machines', () => {
    const p = perf();
    expect(
      previousPerformances({ ...p, equipmentLabel: 'Machine A' }, [
        session({ ...p, equipmentLabel: 'Machine B' }),
      ]),
    ).toEqual([]);
    expect(
      previousPerformances(p, [
        session({ ...p, exercise: { ...p.exercise, id: 'flat-db-press' } }),
      ]),
    ).toEqual([]);
    expect(
      previousPerformances(p, [session({ ...p, exercise: { ...p.exercise, loadMode: 'total' } })]),
    ).toEqual([]);
    expect(
      previousPerformances(
        p,
        [session(p, { programId: 'apex-original' })],
        undefined,
        BOXING_PROGRAM,
      ),
    ).toEqual([]);
  });
});
let database: ApexDB;
beforeEach(async () => {
  database = new ApexDB(`boxing-test-${crypto.randomUUID()}`);
  await seed(database);
});
afterEach(async () => {
  await database.delete();
});
describe('fresh program installation and persistence', () => {
  it('installs once, preserves units and records, and respects later program selection', async () => {
    await database.settings.put({ ...defaultSettings(), weightUnit: 'lb' });
    const old = session(perf(), { programId: 'apex-original' });
    await database.sessions.put(old);
    await seed(database);
    await seed(database);
    expect(await database.settings.get('settings')).toMatchObject({
      programId: BOXING_PROGRAM,
      weightUnit: 'lb',
      appliedUpdates: [BOXING_UPDATE],
    });
    expect(await database.sessions.get(old.id)).toEqual(old);
    expect(await database.programs.count()).toBe(2);
    await database.settings.update('settings', {
      programId: 'apex-original',
      selectedDayId: 'day-1',
    });
    await seed(database);
    expect((await database.settings.get('settings'))?.programId).toBe('apex-original');
  });
  it('snapshots priorities and phases and prefills only this fresh program', async () => {
    await database.sessions.put(session(perf(), { programId: 'apex-original' }));
    const p = program();
    const first = await createSession(p, p.days[0], database);
    expect(first.performances[2].sets[0].loadKg).toBeNull();
    await database.sessions.put(session());
    const next = await createSession(p, p.days[0], database);
    expect(next.performances[2].sets[0].loadKg).toBe(toKg(65, 'lb'));
    p.days[0].exercises[0].priority = 'optional';
    await database.programs.put(p);
    expect((await database.sessions.get(first.id))?.performances[0].prescription.priority).toBe(
      'mandatory',
    );
  });
  it('roundtrips priority, skips, equipment, recovery and interval snapshots in v3', async () => {
    const p = program();
    const s = await createSession(p, p.days[0], database);
    s.performances[0].skipped = { reason: 'Equipment unavailable', at: now() };
    s.performances[1].equipmentLabel = 'Cable A';
    s.recovery = 'limited';
    await saveSession(s, database);
    p.startDate = '2026-01-01';
    p.readiness = { intervals: true, jumps: false };
    const intervals = await createSession(p, p.days[5], database);
    intervals.taskStates = {
      mobility: { done: false, skipped: { reason: 'Time limited', at: now() } },
    };
    await saveSession(intervals, database);
    const cardio = {
      id: 'intervals',
      sessionId: intervals.id,
      date: dateKey(),
      activity: 'Rowing',
      minutes: 16,
      intervals: { rounds: 6, workSeconds: 60, recoverySeconds: 120 },
      speedKmh: null,
      distanceKm: null,
      incline: null,
      rpe: 7,
      heartRate: null,
      notes: '',
      completed: true,
      updatedAt: now(),
    };
    await database.cardio.put(cardio);
    const backup = await createBackup(database);
    expect(backup.version).toBe(3);
    await importBackup(backup, 'replace', database);
    expect(await database.sessions.get(s.id)).toEqual(
      backup.data.sessions.find((item) => item.id === s.id),
    );
    expect(await database.sessions.get(intervals.id)).toEqual(
      backup.data.sessions.find((item) => item.id === intervals.id),
    );
    expect(await database.cardio.get(cardio.id)).toEqual(cardio);
  });
  it('accepts a legacy v2 file without importing fabricated history', async () => {
    const b = await createBackup(database);
    const original = makeOriginalProgram();
    const legacy = {
      ...b,
      version: 2,
      data: {
        ...b.data,
        programs: [original],
        exercises: originalExercises,
        settings: defaultSettings(),
        sessions: [],
      },
    };
    const parsed = parseBackup(JSON.stringify(legacy));
    await importBackup(parsed, 'replace', database);
    expect(await database.sessions.count()).toBe(0);
    expect((await database.settings.get('settings'))?.programId).toBe(BOXING_PROGRAM);
  });
});
