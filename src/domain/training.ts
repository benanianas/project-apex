import type {
  Cardio,
  Exercise,
  Performance,
  Program,
  Rope,
  Session,
  TrainingDay,
  TrainingTask,
} from './model';
import { dateKey } from './model';
import { workingSets } from './calculations';

export const priorityOf = (p: { priority?: 'mandatory' | 'optional' }) => p.priority ?? 'mandatory';
export const priorityOrder = <T extends { priority?: 'mandatory' | 'optional' }>(items: T[]) =>
  [...items].sort(
    (a, b) => Number(priorityOf(a) === 'optional') - Number(priorityOf(b) === 'optional'),
  );
export function blockWeek(program: Program, date = dateKey()) {
  return Math.max(
    1,
    Math.floor(
      (Date.parse(`${date}T12:00:00`) - Date.parse(`${program.startDate}T12:00:00`)) / 604800000,
    ) + 1,
  );
}
export function effectiveDay(program: Program, day: TrainingDay, date = dateKey()): TrainingDay {
  const next = structuredClone(day);
  if (next.intervalPlan && blockWeek(program, date) >= 3 && program.readiness?.intervals) {
    next.cardio = {
      min:
        (next.intervalPlan.rounds * next.intervalPlan.workSeconds) / 60 +
        ((next.intervalPlan.rounds - 1) * next.intervalPlan.recoverySeconds) / 60,
      max:
        (next.intervalPlan.rounds * next.intervalPlan.workSeconds) / 60 +
        ((next.intervalPlan.rounds - 1) * next.intervalPlan.recoverySeconds) / 60,
      speedMin: null,
      speedMax: null,
      rpe: '7 on efforts; easy between',
      activity: 'Cycling',
    };
    next.intervalActive = true;
    next.tasks = next.tasks?.map((t) =>
      t.kind === 'cardio'
        ? {
            ...t,
            label: `${next.intervalPlan!.rounds} × ${next.intervalPlan!.workSeconds / 60} min bike or rower efforts · RPE 7 · ${next.intervalPlan!.recoverySeconds / 60} min easy between`,
            minutes: next.cardio!.min,
          }
        : t,
    );
  }
  if (next.powerOption && blockWeek(program, date) >= 3 && program.readiness?.jumps) {
    // This low-volume preparation remains optional and precedes strength work in the warm-up.
    next.warmup = [
      ...next.warmup,
      'Optional squat jumps — 3 × 3, full recovery between sets. Only with good recovery and joint tolerance.',
    ];
  }
  next.exercises = priorityOrder(next.exercises);
  if (next.tasks) next.tasks = priorityOrder(next.tasks);
  return next;
}
export const exerciseComplete = (p: Performance) =>
  !p.skipped && workingSets(p).length >= p.prescription.sets;
export const taskLabel = (task: TrainingTask) =>
  task.target
    ? `${task.label} — ${task.target.rounds} × ${task.target.workSeconds}s · ${task.target.recoverySeconds}s rest`
    : task.label;
const intervalRounds = (session: Session, cardio: Cardio[]) =>
  cardio
    .filter(
      (c) =>
        c.sessionId === session.id &&
        c.completed &&
        c.intervals &&
        c.intervals.workSeconds >= (session.daySnapshot?.intervalPlan?.workSeconds ?? 0),
    )
    .reduce((n, c) => n + c.intervals!.rounds, 0);
export function taskComplete(task: TrainingTask, session: Session, cardio: Cardio[], rope: Rope[]) {
  if (session.taskStates?.[task.id]?.skipped) return false;
  if (task.kind === 'rope')
    return (
      rope
        .filter(
          (r) =>
            r.sessionId === session.id &&
            r.completed &&
            (!task.target || r.workSeconds >= task.target.workSeconds),
        )
        .reduce((n, r) => n + r.rounds, 0) >= (task.target?.rounds ?? 1)
    );
  if (task.kind !== 'cardio') return !!session.taskStates?.[task.id]?.done;
  const records = cardio.filter((c) => c.sessionId === session.id && c.completed);
  const interval = session.daySnapshot?.intervalActive && session.daySnapshot.intervalPlan;
  if (interval) return intervalRounds(session, cardio) >= interval.rounds;
  return records.reduce((n, c) => n + c.minutes, 0) >= (session.daySnapshot?.cardio?.min ?? 1);
}
export function sessionProgress(session: Session, cardio: Cardio[] = [], rope: Rope[] = []) {
  const items = session.performances.map((p) => ({
    priority: priorityOf(p.prescription),
    done: exerciseComplete(p),
    skipped: !!p.skipped,
    minutes: p.skipped
      ? 0
      : (Math.max(0, p.prescription.sets - workingSets(p).length) *
          ((p.prescription.unit === 'seconds'
            ? p.prescription.max
            : p.prescription.unit === 'submax'
              ? 30
              : p.prescription.max * 3) +
            p.prescription.rest)) /
        60,
  }));
  for (const task of session.daySnapshot?.tasks ?? []) {
    const state = session.taskStates?.[task.id];
    const minutes = cardio
      .filter((c) => c.sessionId === session.id && c.completed)
      .reduce((n, c) => n + c.minutes, 0);
    const done = taskComplete(task, session, cardio, rope);
    items.push({
      priority: priorityOf(task),
      done,
      skipped: !!state?.skipped,
      minutes:
        state?.skipped || done
          ? 0
          : task.kind === 'cardio'
            ? session.daySnapshot?.intervalActive && session.daySnapshot.intervalPlan
              ? task.minutes *
                Math.max(
                  0,
                  1 - intervalRounds(session, cardio) / session.daySnapshot.intervalPlan.rounds,
                )
              : Math.max(0, task.minutes - minutes)
            : task.minutes,
    });
  }
  const mandatory = items.filter((i) => i.priority === 'mandatory');
  const optional = items.filter((i) => i.priority === 'optional');
  const mandatoryDone = mandatory.filter((i) => i.done).length;
  return {
    mandatory: mandatory.length,
    mandatoryDone,
    optional: optional.length,
    optionalDone: optional.filter((i) => i.done).length,
    essential:
      mandatory.length === 0
        ? ('none' as const)
        : mandatoryDone === mandatory.length
          ? ('complete' as const)
          : ('partial' as const),
    skipped: items.filter((i) => i.skipped).length,
    remainingMinutes: Math.ceil(
      items.filter((i) => !i.done && !i.skipped).reduce((n, i) => n + i.minutes, 0),
    ),
  };
}
export function comparableEquipment(a: Exercise, b: Exercise) {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.loadMode === b.loadMode &&
    a.sides === b.sides &&
    a.equipment === b.equipment
  );
}
