import { exerciseHistory, progression, workingSets } from './calculations';
import { comparableEquipment } from './training';
import type { Performance, Session, Exercise } from './model';
export function previousPerformances(
  current: Pick<Performance, 'exercise' | 'equipmentLabel'>,
  sessions: Session[],
  excludeId?: string,
  programId?: string,
) {
  return exerciseHistory(
    current.exercise.id,
    sessions.filter((s) => s.id !== excludeId && (!programId || s.programId === programId)),
  ).filter(
    ({ performance: p }) =>
      comparableEquipment(current.exercise, p.exercise) &&
      (current.equipmentLabel ?? '').trim().toLowerCase() ===
        (p.equipmentLabel ?? '').trim().toLowerCase(),
  );
}
export function currentSuggestion(
  current: Performance,
  sessions: Session[],
  excludeId: string,
  increment: number,
  programId?: string,
) {
  const history = previousPerformances(current, sessions, excludeId, programId);
  const last = history.at(-1)?.performance;
  if (!last) return null;
  return progression(
    { ...last, prescription: current.prescription },
    history.at(-2)?.performance,
    increment,
  );
}
export function prefillSets(exercise: Exercise, sessions: Session[], programId?: string) {
  const last = previousPerformances({ exercise }, sessions, undefined, programId).at(
    -1,
  )?.performance;
  return last ? workingSets(last) : [];
}
