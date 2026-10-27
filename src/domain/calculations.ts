import {
  dateKey,
  type Cardio,
  type Exercise,
  type Performance,
  type Program,
  type Rope,
  type Session,
  type SetRecord,
} from './model';
export const LB_PER_KG = 2.2046226218487757;
export const KM_PER_MILE = 1.609344;
export const toKg = (v: number, u: 'kg' | 'lb') => (u === 'lb' ? v / LB_PER_KG : v);
export const fromKg = (v: number, u: 'kg' | 'lb') => (u === 'lb' ? v * LB_PER_KG : v);
export const toKmh = (v: number, u: 'mph' | 'km/h') => (u === 'mph' ? v * KM_PER_MILE : v);
export const fromKmh = (v: number, u: 'mph' | 'km/h') => (u === 'mph' ? v / KM_PER_MILE : v);
export const toKm = (v: number, u: 'mi' | 'km') => (u === 'mi' ? v * KM_PER_MILE : v);
export const fromKm = (v: number, u: 'mi' | 'km') => (u === 'mi' ? v / KM_PER_MILE : v);
export const rounded = (v: number, d = 1) => Number(v.toFixed(d));
export const workingSets = (p: Performance) =>
  p.sets.filter((s) => s.done && !s.warmup && !setProblem(p.exercise, s));
export const volumeCompatible = (e: Exercise) => e.type === 'resistance';
export function setVolume(e: Exercise, s: SetRecord): number | null {
  if (!volumeCompatible(e)) return null;
  if (!s.done || s.warmup || s.loadKg === null || s.reps === null) return 0;
  // For two dumbbells the combined load moves on each rep; per-side reps describe both sides.
  return s.loadKg * (e.loadMode === 'per-hand' ? 2 : 1) * s.reps * e.sides;
}
export const performanceVolume = (p: Performance) =>
  volumeCompatible(p.exercise)
    ? p.sets.reduce((n, s) => n + (setVolume(p.exercise, s) ?? 0), 0)
    : null;
export const sessionVolume = (s: Session) =>
  s.performances.reduce((n, p) => n + (performanceVolume(p) ?? 0), 0);
export function setProblem(e: Exercise, s: SetRecord): string | null {
  if (
    ['resistance', 'bodyweight', 'assisted', 'weighted-bodyweight'].includes(e.type) &&
    !(s.reps !== null && s.reps > 0)
  )
    return 'Enter repetitions greater than zero.';
  if (
    ['resistance', 'assisted', 'weighted-bodyweight', 'carry'].includes(e.type) &&
    s.loadKg === null
  )
    return 'Enter the load or assistance (zero is allowed).';
  if (e.type === 'timed' && !(s.seconds !== null && s.seconds > 0))
    return 'Enter a duration greater than zero.';
  if (e.type === 'distance' && !(s.meters !== null && s.meters > 0))
    return 'Enter a distance greater than zero.';
  if (
    e.type === 'carry' &&
    !(s.seconds !== null && s.seconds > 0) &&
    !(s.meters !== null && s.meters > 0)
  )
    return 'Enter a carry duration or distance.';
  return null;
}
export function estimate1RM(e: Exercise, s: SetRecord): number | null {
  if (
    e.type !== 'resistance' ||
    e.sides !== 1 ||
    e.category === 'isolation' ||
    !s.done ||
    s.warmup ||
    !s.loadKg ||
    !s.reps ||
    s.reps > 10
  )
    return null;
  return s.loadKg * (e.loadMode === 'per-hand' ? 2 : 1) * (1 + s.reps / 30);
}
export function cardioDistance(
  speedKmh: number | null,
  minutes: number,
  manual: number | null = null,
) {
  return manual ?? (speedKmh !== null && speedKmh > 0 ? (speedKmh * minutes) / 60 : null);
}
export function cardioPace(c: Cardio) {
  const distance = cardioDistance(c.speedKmh, c.minutes, c.distanceKm);
  return distance !== null && distance > 0 ? c.minutes / distance : null;
}
export const ropeActive = (r: Pick<Rope, 'rounds' | 'workSeconds'>) => r.rounds * r.workSeconds;
export function weekStart(date: string, start = 3) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() - start + 7) % 7));
  return dateKey(d);
}
export function daysAgo(n: number, from = dateKey()) {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() - n);
  return dateKey(d);
}
export const inRange = (date: string, weeks: number) => !weeks || date >= daysAgo(weeks * 7);
export const weekNumber = (p: Program) =>
  Math.max(
    1,
    Math.floor(
      (Date.parse(`${dateKey()}T12:00:00`) - Date.parse(`${p.startDate}T12:00:00`)) / 604800000,
    ) + 1,
  );
export function consistency(
  sessions: Session[],
  cardio: Cardio[],
  program: Program,
  date = dateKey(),
  boundary = 3,
) {
  const start = weekStart(date, boundary);
  const end = daysAgo(-7, start);
  const ss = sessions.filter((s) => s.status === 'completed' && s.date >= start && s.date < end);
  const cs = cardio.filter((c) => c.completed && c.date >= start && c.date < end);
  const lifting = ss.filter((s) => s.kind === 'strength').length;
  const cardioCount = new Set([
    ...cs.map((c) => c.sessionId ?? c.id),
    ...ss.filter((s) => s.kind === 'cardio').map((s) => s.id),
  ]).size;
  const strengthTarget = program.days.filter((d) => d.kind === 'strength').length,
    cardioTarget = program.days.filter((d) => d.kind === 'cardio').length;
  const target = strengthTarget + cardioTarget;
  return {
    start,
    end,
    lifting,
    cardio: cardioCount,
    strengthTarget,
    cardioTarget,
    percent: target
      ? Math.round(
          ((Math.min(lifting, strengthTarget) + Math.min(cardioCount, cardioTarget)) / target) *
            100,
        )
      : 0,
    days: new Set([...ss.map((s) => s.date), ...cs.map((s) => s.date)]).size,
    recovery: ss.filter((s) => s.kind === 'recovery').length,
    sets: ss.flatMap((s) => s.performances).reduce((n, p) => n + workingSets(p).length, 0),
    minutes: cs.reduce((n, c) => n + c.minutes, 0),
  };
}
export function progression(
  current: Performance,
  previous: Performance | undefined,
  increment = 2.5,
) {
  const sets = workingSets(current);
  const p = current.prescription;
  const e = current.exercise;
  if (e.type !== 'resistance' || p.unit !== 'reps')
    return {
      title: 'Track this movement on its own terms',
      detail:
        'Use controlled repetitions, assistance, time or distance. A conventional load increase is not inferred for this movement.',
    };
  if (sets.length !== p.sets || sets.some((s) => s.reps === null || s.loadKg === null))
    return {
      title: 'Repeat the current prescription',
      detail: `Complete all ${p.sets} prescribed working sets before assessing progression.`,
    };
  if (sets.some((s) => s.loadKg !== sets[0].loadKg))
    return {
      title: 'Keep building a comparable baseline',
      detail: 'Working loads differ within this session. Compare complete sets at the same load.',
    };
  const effortKnown = sets.every((s) => s.rir !== null || s.rpe !== null);
  const minRir = e.category === 'heavy' ? 2 : e.category === 'isolation' ? 0 : 1;
  const effortOkay = sets.every(
    (s) => (s.rir === null || s.rir >= minRir) && (s.rpe === null || s.rpe <= 10 - minRir),
  );
  if (sets.every((s) => s.reps! >= p.max) && effortKnown && effortOkay) {
    const next = (Math.floor((sets[0].loadKg! + 1e-8) / increment) + 1) * increment;
    return {
      title: 'Consider a small load increase',
      detail: `All ${p.sets} sets reached ${p.max} reps with appropriate logged effort. If technique stayed controlled, consider the next equipment increment.`,
      nextKg: next,
    };
  }
  if (sets.every((s) => s.reps! >= p.max) && !effortKnown)
    return {
      title: 'Confirm effort before adding load',
      detail:
        'The repetition target is met, but effort is unknown. Repeat or log RIR/RPE and confirm controlled technique before increasing.',
    };
  const prev = previous && workingSets(previous);
  const comparable =
    previous &&
    previous.exercise.id === e.id &&
    previous.prescription.min === p.min &&
    previous.prescription.max === p.max &&
    previous.prescription.sets === p.sets &&
    prev?.length === p.sets &&
    prev.every((s) => s.loadKg === sets[0].loadKg);
  if (sets.some((s) => s.reps! < p.min) && comparable && prev!.some((s) => (s.reps ?? 0) < p.min))
    return {
      title: 'Review load and recovery',
      detail:
        'Two comparable sessions fell below the repetition range. Consider a small load reduction or more recovery.',
    };
  if (!effortOkay)
    return {
      title: 'Maintain the current load',
      detail:
        'Logged effort is above the intended range. Repeat with controlled technique and appropriate repetitions in reserve.',
    };
  return {
    title: 'Build repetitions at this load',
    detail: `Work toward ${p.sets} × ${p.max} with controlled technique. Add repetitions gradually within ${p.min}–${p.max}.`,
  };
}
export function exerciseHistory(id: string, sessions: Session[]) {
  return sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
    .flatMap((s) =>
      s.performances
        .filter((p) => p.exercise.id === id && workingSets(p).length > 0)
        .map((p) => ({ session: s, performance: p })),
    );
}
export function weeklyStats(sessions: Session[], cardio: Cardio[], rope: Rope[], start = 3) {
  const map = new Map<
    string,
    { date: string; volume: number; sets: number; minutes: number; rope: number }
  >();
  const row = (d: string) => {
    const date = weekStart(d, start);
    if (!map.has(date)) map.set(date, { date, volume: 0, sets: 0, minutes: 0, rope: 0 });
    return map.get(date)!;
  };
  sessions
    .filter((s) => s.status === 'completed')
    .forEach((s) => {
      const r = row(s.date);
      r.volume += sessionVolume(s);
      r.sets += s.performances.reduce((n, p) => n + workingSets(p).length, 0);
    });
  cardio.filter((c) => c.completed).forEach((c) => (row(c.date).minutes += c.minutes));
  rope.filter((r) => r.completed).forEach((r) => (row(r.date).rope += ropeActive(r) / 60));
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function muscleSets(sessions: Session[]) {
  const sums: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const s of sessions.filter((s) => s.status === 'completed'))
    for (const p of s.performances) {
      const count = workingSets(p).length;
      sums[p.exercise.primary] = (sums[p.exercise.primary] ?? 0) + count;
    }
  return Object.entries(sums)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}
export function exercisePoints(id: string, sessions: Session[], metric: string) {
  return exerciseHistory(id, sessions).flatMap(({ session, performance: p }) => {
    if (metric === 'volume') {
      const value = performanceVolume(p);
      return value === null ? [] : [{ date: session.date, value }];
    }
    const values = workingSets(p)
      .map((s) =>
        metric === 'load'
          ? s.loadKg
          : metric === 'estimate'
            ? estimate1RM(p.exercise, s)
            : metric === 'seconds'
              ? s.seconds
              : metric === 'meters'
                ? s.meters
                : s.reps === null
                  ? null
                  : s.reps * p.exercise.sides,
      )
      .filter((v): v is number => v !== null);
    if (!values.length) return [];
    const value =
      metric === 'load' && p.exercise.type === 'assisted'
        ? Math.min(...values)
        : metric === 'load' || metric === 'estimate'
          ? Math.max(...values)
          : values.reduce((a, b) => a + b, 0);
    return [{ date: session.date, value }];
  });
}
