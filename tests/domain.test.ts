import { prepareExerciseSession } from '../src/domain/exerciseSession';
import { describe, expect, it } from 'vitest';
import { originalExercises, findGuide } from '../src/data/exercises';
import { makeOriginalProgram, originalDays, ropeStages } from '../src/data/program';
import {
  cardioSchema,
  dateKey,
  exerciseSchema,
  localDate,
  newSet,
  now,
  prescriptionSchema,
  programSchema,
  ropeSchema,
  setSchema,
  type Cardio,
  type Performance,
  type Session,
} from '../src/domain/model';
import {
  cardioDistance,
  cardioPace,
  consistency,
  daysAgo,
  estimate1RM,
  exercisePoints,
  fromKg,
  fromKm,
  fromKmh,
  muscleSets,
  performanceVolume,
  progression,
  ropeActive,
  sessionVolume,
  setProblem,
  setVolume,
  toKg,
  toKm,
  toKmh,
  weekStart,
  weeklyStats,
} from '../src/domain/calculations';
const ex = (id: string) => structuredClone(originalExercises.find((e) => e.id === id)!);
const set = (patch = {}) => ({ ...newSet(), loadKg: 20, reps: 10, rir: 2, done: true, ...patch });
function perf(id = 'incline-db-press', patch: Partial<Performance> = {}): Performance {
  return {
    id: 'performance',
    exercise: ex(id),
    prescription: {
      id: 'rx',
      exerciseId: id,
      sets: 3,
      min: 6,
      max: 10,
      unit: 'reps',
      rest: 120,
      alternatives: [],
    },
    sets: [set(), set(), set()],
    ...patch,
  };
}
function session(date = '2026-10-21', performances = [perf()]): Session {
  return {
    id: crypto.randomUUID(),
    programId: 'apex-original',
    dayId: 'day-1',
    title: 'Test session',
    kind: 'strength',
    date,
    startedAt: now(),
    finishedAt: now(),
    status: 'completed',
    performances,
    warmup: [],
    mobility: [],
    checklist: {},
    notes: '',
    updatedAt: now(),
  };
}
function cardio(patch: Partial<Cardio> = {}): Cardio {
  return {
    id: crypto.randomUUID(),
    sessionId: null,
    date: '2026-10-21',
    activity: 'Treadmill running',
    minutes: 30,
    speedKmh: 10,
    distanceKm: null,
    incline: null,
    rpe: 4,
    heartRate: null,
    notes: '',
    completed: true,
    updatedAt: now(),
    ...patch,
  };
}
describe('faithful original program and guides', () => {
  it('seeds all seven numbered days and exact strength set totals', () => {
    expect(originalDays).toHaveLength(7);
    expect(originalDays.map((d) => d.weekday)).toEqual(Array(7).fill(null));
    expect(
      originalDays
        .filter((d) => d.kind === 'strength')
        .map((d) => d.exercises.reduce((n, p) => n + p.sets, 0)),
    ).toEqual([23, 24, 24]);
    expect(originalDays[0].exercises).toHaveLength(9);
    expect(originalDays[2].exercises).toHaveLength(10);
    expect(originalDays[4].exercises).toHaveLength(10);
    expect(programSchema.safeParse(makeOriginalProgram()).success).toBe(true);
  });
  it('keeps substitutions distinct and timed/submax prescriptions explicit', () => {
    expect(originalDays[0].exercises[0].alternatives).toEqual(['assisted-pull-up']);
    expect(originalDays[4].exercises.find((p) => p.exerciseId === 'farmer-carry')?.unit).toBe(
      'seconds',
    );
    expect(originalDays[4].exercises.find((p) => p.exerciseId === 'push-up')?.unit).toBe('submax');
    expect(originalDays[2].exercises.find((p) => p.exerciseId === 'split-squat')?.sets).toBe(2);
  });
  it('preserves cardio defaults and rope progression', () => {
    expect(originalDays[1].cardio).toMatchObject({
      min: 30,
      max: 35,
      speedMin: 5.5,
      speedMax: 6,
      rpe: '3–4',
    });
    expect(originalDays[5].cardio).toMatchObject({ min: 30, max: 40, rpe: '3–4' });
    expect(ropeStages.map((s) => [s.rounds, s.work])).toEqual([
      [5, 30],
      [6, 45],
      [6, 60],
      [5, 90],
      [5, 120],
      [3, 180],
    ]);
  });
  it('has valid, unique local guides for every prescription, alternative and warm-up', () => {
    expect(new Set(originalExercises.map((e) => e.id)).size).toBe(originalExercises.length);
    for (const e of originalExercises) {
      expect(exerciseSchema.safeParse(e).success, e.name).toBe(true);
      expect(e.steps.length).toBeGreaterThanOrEqual(3);
      expect(e.cues.length).toBeGreaterThan(0);
      for (const id of e.alternatives)
        expect(
          originalExercises.find((e) => e.id === id),
          id,
        ).toBeTruthy();
    }
    for (const day of originalDays) {
      for (const p of day.exercises)
        for (const id of [p.exerciseId, ...p.alternatives])
          expect(
            originalExercises.find((e) => e.id === id),
            id,
          ).toBeTruthy();
      for (const item of [...day.warmup, ...day.mobility])
        expect(findGuide(item), item).toBeTruthy();
    }
  });
});
describe('load semantics', () => {
  it('computes standard and per-hand external load correctly', () => {
    expect(setVolume(ex('squat'), set({ loadKg: 100, reps: 5 }))).toBe(500);
    expect(setVolume(ex('incline-db-press'), set())).toBe(400);
  });
  it('counts each side once with the combined load moved each rep', () => {
    expect(setVolume(ex('split-squat'), set({ loadKg: 10, reps: 8 }))).toBe(320);
    expect(setVolume(ex('one-db-row'), set({ loadKg: 20, reps: 10 }))).toBe(400);
  });
  it('excludes warm-up and unfinished sets', () => {
    expect(setVolume(ex('squat'), set({ warmup: true }))).toBe(0);
    expect(setVolume(ex('squat'), set({ done: false }))).toBe(0);
    expect(
      performanceVolume(
        perf('squat', { sets: [set(), set({ warmup: true }), set({ done: false })] }),
      ),
    ).toBe(200);
  });
  it.each(['pull-up', 'assisted-pull-up', 'farmer-carry', 'jump-rope'])(
    'does not invent conventional tonnage for %s',
    (id) => {
      expect(setVolume(ex(id), set())).toBeNull();
      expect(performanceVolume(perf(id))).toBeNull();
    },
  );
  it('requires relevant completed values while allowing zero external load', () => {
    expect(setProblem(ex('squat'), set({ loadKg: 0 }))).toBeNull();
    expect(setProblem(ex('squat'), set({ reps: 0 }))).toMatch(/repetitions/);
    expect(setProblem(ex('pull-up'), set({ loadKg: null }))).toBeNull();
    expect(setProblem(ex('assisted-pull-up'), set({ loadKg: null }))).toMatch(/assistance/);
    expect(
      setProblem(ex('farmer-carry'), set({ seconds: null, meters: 20, reps: null })),
    ).toBeNull();
    expect(setProblem(ex('farmer-carry'), set({ reps: 10 }))).toMatch(/duration or distance/);
  });
  it('aggregates only meaningful session volume', () => {
    expect(sessionVolume(session(undefined, [perf('pull-up'), perf('incline-db-press')]))).toBe(
      1200,
    );
  });
  it('estimates strength only for eligible sets', () => {
    expect(estimate1RM(ex('squat'), set({ loadKg: 100, reps: 5 }))).toBeCloseTo(116.6667);
    for (const id of ['pull-up', 'assisted-pull-up', 'farmer-carry', 'lateral-raise', 'one-db-row'])
      expect(estimate1RM(ex(id), set())).toBeNull();
    expect(estimate1RM(ex('squat'), set({ reps: 11 }))).toBeNull();
  });
});
describe('conservative progression', () => {
  it('suggests an equipment-aligned increase only with full targets and effort', () => {
    expect(progression(perf(), undefined, 2.5).nextKg).toBe(22.5);
    expect(
      progression(
        perf(undefined, { sets: [set({ loadKg: 21 }), set({ loadKg: 21 }), set({ loadKg: 21 })] }),
        undefined,
        2.5,
      ).nextKg,
    ).toBe(22.5);
  });
  it('treats unknown RIR as unknown, not zero', () => {
    expect(
      progression(
        perf(undefined, { sets: [set({ rir: null }), set({ rir: null }), set({ rir: null })] }),
        undefined,
      ).title,
    ).toMatch(/Confirm effort/);
  });
  it('accepts an RPE substitute but rejects excessive compound effort', () => {
    expect(
      progression(
        perf(undefined, {
          sets: [
            set({ rir: null, rpe: 8 }),
            set({ rir: null, rpe: 8 }),
            set({ rir: null, rpe: 8 }),
          ],
        }),
        undefined,
      ).nextKg,
    ).toBeDefined();
    expect(
      progression(
        perf('squat', { sets: [set({ rir: 0 }), set({ rir: 0 }), set({ rir: 0 })] }),
        undefined,
      ).nextKg,
    ).toBeUndefined();
  });
  it('does not progress partial, extra, or mixed-load records', () => {
    for (const sets of [
      [set(), set()],
      [set(), set(), set(), set()],
      [set(), set({ loadKg: 18 }), set()],
    ])
      expect(progression(perf(undefined, { sets }), undefined).nextKg).toBeUndefined();
  });
  it('does not progress bodyweight, submax or incomplete sets', () => {
    expect(progression(perf('pull-up'), undefined).nextKg).toBeUndefined();
    expect(
      progression(perf(undefined, { sets: [set(), set(), set({ done: false })] }), undefined)
        .nextKg,
    ).toBeUndefined();
  });
  it('recognizes repeated difficulty only in comparable records', () => {
    const poor = perf(undefined, { sets: [set({ reps: 4 }), set({ reps: 4 }), set({ reps: 4 })] });
    expect(progression(poor, poor).title).toMatch(/recovery/);
    expect(progression(poor, perf('squat')).title).not.toMatch(/recovery/);
  });
  it('validates boundaries and rejects negatives/nonfinite inputs', () => {
    expect(prescriptionSchema.safeParse({ ...perf().prescription, min: 12, max: 6 }).success).toBe(
      false,
    );
    expect(prescriptionSchema.safeParse({ ...perf().prescription, min: 8, max: 8 }).success).toBe(
      true,
    );
    for (const n of [-1, NaN, Infinity])
      expect(setSchema.safeParse(set({ loadKg: n })).success).toBe(false);
    expect(setSchema.safeParse(set({ reps: 1.5 })).success).toBe(false);
  });
});
describe('cardio, rope and conversions', () => {
  it('roundtrips normalized units without modifying history', () => {
    expect(toKg(220.46226218487757, 'lb')).toBeCloseTo(100);
    expect(toKg(fromKg(20, 'lb'), 'lb')).toBeCloseTo(20);
    expect(toKmh(6, 'mph')).toBeCloseTo(9.656064);
    expect(fromKmh(toKmh(6, 'mph'), 'mph')).toBeCloseTo(6);
    expect(toKm(fromKm(10, 'mi'), 'mi')).toBeCloseTo(10);
  });
  it('derives distance and pace only from known inputs', () => {
    expect(cardioDistance(10, 30)).toBe(5);
    expect(cardioDistance(null, 30)).toBeNull();
    expect(cardioDistance(10, 30, 4)).toBe(4);
    expect(cardioPace(cardio())).toBe(6);
    expect(cardioPace(cardio({ speedKmh: null }))).toBeNull();
  });
  it('validates actual cardio measurements', () => {
    expect(cardioSchema.safeParse(cardio({ minutes: 0 })).success).toBe(false);
    expect(cardioSchema.safeParse(cardio({ rpe: 11 })).success).toBe(false);
    expect(cardioSchema.safeParse(cardio({ speedKmh: 0 })).success).toBe(true);
  });
  it('calculates rope work without rests and rejects impossible elapsed time', () => {
    expect(ropeActive({ rounds: 5, workSeconds: 30 })).toBe(150);
    expect(
      ropeSchema.safeParse({
        id: 'rope',
        sessionId: null,
        date: dateKey(),
        rounds: 5,
        workSeconds: 30,
        restSeconds: 60,
        elapsedSeconds: 100,
        rpe: null,
        tolerance: 'good',
        notes: '',
        completed: true,
        updatedAt: now(),
      }).success,
    ).toBe(false);
  });
});
describe('reporting calendar and consistency', () => {
  it('uses Wednesday through Tuesday across month/year and DST boundaries', () => {
    expect(weekStart('2026-10-20')).toBe('2026-10-14');
    expect(weekStart('2026-10-21')).toBe('2026-10-21');
    expect(weekStart('2027-01-01')).toBe('2026-12-30');
    expect(weekStart('2026-11-01')).toBe('2026-10-28');
    expect(weekStart('2026-10-20', 1)).toBe('2026-10-19');
    expect(daysAgo(-7, '2026-10-28')).toBe('2026-11-04');
  });
  it('rejects impossible calendar dates', () => {
    expect(localDate.safeParse('2026-02-30').success).toBe(false);
    expect(localDate.safeParse('2028-02-29').success).toBe(true);
  });
  it('does not double-count cardio activities linked to a session', () => {
    const s = { ...session(), kind: 'cardio' as const, performances: [] };
    const a = cardio({ sessionId: s.id });
    const b = cardio({ sessionId: s.id });
    const result = consistency([session(), s], [a, b], makeOriginalProgram(), '2026-10-22');
    expect(result.lifting).toBe(1);
    expect(result.cardio).toBe(1);
    expect(result.percent).toBe(40);
    expect(result.days).toBe(1);
    expect(result.minutes).toBe(60);
  });
  it('caps adherence and excludes rest/recovery from the target', () => {
    const result = consistency(
      Array.from({ length: 4 }, () => session()),
      [cardio(), cardio(), cardio()],
      makeOriginalProgram(),
      '2026-10-22',
    );
    expect(result.percent).toBe(100);
    expect(result.strengthTarget + result.cardioTarget).toBe(5);
  });
  it('aggregates weekly records and excludes unfinished activity', () => {
    const weeks = weeklyStats(
      [session('2026-10-20'), session('2026-10-21')],
      [cardio(), cardio({ completed: false })],
      [],
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[0].date).toBe('2026-10-14');
    expect(weeks[1].minutes).toBe(30);
  });
  it('assigns each working set to one primary muscle', () => {
    expect(muscleSets([session(undefined, [perf(), perf('pull-up')])])).toEqual([
      ['Chest', 3],
      ['Lats', 3],
    ]);
  });
  it('keeps substitutions separate and dates sorted', () => {
    const points = exercisePoints(
      'incline-db-press',
      [session('2026-10-22'), session('2026-10-20'), session('2026-10-21', [perf('squat')])],
      'volume',
    );
    expect(points.map((x) => x.date)).toEqual(['2026-10-20', '2026-10-22']);
    expect(points[0].value).toBe(1200);
  });
});

describe('individual exercise session preparation', () => {
  it('uses the actual alternative and its prescribed targets without completing a program day', () => {
    const program = makeOriginalProgram();
    const draft = prepareExerciseSession(ex('assisted-pull-up'), program, [], program.days[0].id);
    expect(draft.dayId).not.toBe(program.days[0].id);
    expect(draft.performances[0].exercise.id).toBe('assisted-pull-up');
    expect(draft.performances[0].prescription).toMatchObject({ sets: 3, min: 5, max: 8 });
    expect(draft.performances[0].sets.every((s) => !s.done && s.loadKg === null)).toBe(true);
  });
  it('prefills completed working sets and resets effort, completion and identity', () => {
    const program = makeOriginalProgram();
    const old = perf();
    const draft = prepareExerciseSession(
      ex('incline-db-press'),
      program,
      [session(dateKey(), [old])],
      program.days[0].id,
    );
    const row = draft.performances[0].sets[0];
    expect(row).toMatchObject({ loadKg: 20, reps: 10, done: false, rir: null, rpe: null });
    expect(row.id).not.toBe(old.sets[0].id);
  });
  it('omits sessions with no completed working sets from exercise charts', () => {
    expect(
      exercisePoints(
        'incline-db-press',
        [session(dateKey(), [perf(undefined, { sets: [set({ done: false })] })])],
        'volume',
      ),
    ).toEqual([]);
  });
});
