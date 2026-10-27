import { dateKey, newSet, now, uid, type Exercise, type Program, type Session } from './model';
import { prefillSets } from './history';

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
  const old = prefillSets(exercise, sessions, program.freshHistory ? program.id : undefined);
  return {
    id: uid(),
    programId: program.id,
    historyProgramId: program.freshHistory ? program.id : undefined,
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
