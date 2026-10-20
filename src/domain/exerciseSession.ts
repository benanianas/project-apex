import { dateKey, newSet, now, uid, type Exercise, type Program, type Session } from './model';
import { exerciseHistory, workingSets } from './calculations';

/** Prepare an individual session without writing anything just by opening a page. */
export function prepareExerciseSession(
  exercise: Exercise,
  program: Program,
  sessions: Session[],
  selectedDayId: string,
): Session {
  const days = [...program.days].sort(
    (a, b) => Number(b.id === selectedDayId) - Number(a.id === selectedDayId),
  );
  const target = days
    .flatMap((d) => d.exercises)
    .find((p) => p.exerciseId === exercise.id || p.alternatives.includes(exercise.id));
  const timed = ['timed', 'carry'].includes(exercise.type);
  const prescription = target
    ? { ...structuredClone(target), exerciseId: exercise.id }
    : {
        id: uid(),
        exerciseId: exercise.id,
        sets: 3,
        min: timed ? 30 : 8,
        max: timed ? 45 : 12,
        unit: timed
          ? ('seconds' as const)
          : exercise.type === 'distance'
            ? ('meters' as const)
            : ('reps' as const),
        rest: 120,
        alternatives: [...exercise.alternatives],
      };
  const history = exerciseHistory(exercise.id, sessions).filter(
    ({ performance: p }) =>
      p.exercise.type === exercise.type &&
      p.exercise.sides === exercise.sides &&
      p.exercise.loadMode === exercise.loadMode,
  );
  const previous = history.at(-1)?.performance;
  const old = previous ? workingSets(previous) : [];
  return {
    id: uid(),
    programId: program.id,
    dayId: `individual-${exercise.id}`,
    title: exercise.name,
    kind: 'strength',
    date: dateKey(),
    startedAt: now(),
    finishedAt: null,
    status: 'draft',
    warmup: [],
    mobility: [],
    checklist: {},
    notes: '',
    updatedAt: now(),
    performances: [
      {
        id: uid(),
        exercise: structuredClone(exercise),
        prescription,
        sets: Array.from({ length: prescription.sets }, (_, i) => ({
          ...newSet(),
          ...(old[i]
            ? {
                loadKg: old[i].loadKg,
                reps: old[i].reps,
                seconds: old[i].seconds,
                meters: old[i].meters,
              }
            : {}),
        })),
      },
    ],
  };
}
