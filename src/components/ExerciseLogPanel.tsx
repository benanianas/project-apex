import { useRef, useState } from 'react';
import { ArrowUpRight, Undo2 } from 'lucide-react';
import DiscardWorkoutDialog from './DiscardWorkoutDialog';
import { db, discardDraftSession, saveSession } from '../storage/db';
import { now, type Exercise, type Performance, type SetRecord } from '../domain/model';
import { prepareExerciseSession } from '../domain/exerciseSession';
import { setProblem, workingSets } from '../domain/calculations';
import { go, Section, useData } from './ui';
import SetEditor from './SetEditor';
import RestTimer, { startRest } from './RestTimer';

export default function ExerciseLogPanel({ exercise }: { exercise: Exercise }) {
  const { sessions, program, settings, notify, report } = useData();
  const [initial] = useState(
    () =>
      [...sessions]
        .filter(
          (s) => s.status === 'draft' && s.performances.some((p) => p.exercise.id === exercise.id),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
      prepareExerciseSession(exercise, program, sessions, settings.selectedDayId),
  );
  const [performance, setPerformance] = useState(() =>
    initial.performances.find((p) => p.exercise.id === exercise.id)!,
  );
  const current = useRef(performance);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const discarding = useRef(false);
  const [canceling, setCanceling] = useState(false);
  const [state, setState] = useState(
    sessions.some((s) => s.id === initial.id) ? 'Saved on device' : 'Ready to log',
  );
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Performance | null>(null);
  const individual = initial.dayId.startsWith('individual-');
  function persist(next: Performance) {
    if (discarding.current) return;
    const version = ++revision.current;
    current.current = next;
    setPerformance(next);
    setState('Saving…');
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          // Preserve other exercises and session edits if another view has saved meanwhile.
          await db.transaction('rw', db.sessions, async () => {
            const saved = (await db.sessions.get(initial.id)) ?? initial;
            await saveSession({
              ...saved,
              performances: saved.performances.map((p) => (p.id === next.id ? next : p)),
            });
          });
          if (version === revision.current) {
            setFailed(false);
            setState('Saved on device');
          }
        } catch (error) {
          if (version === revision.current) {
            setFailed(true);
            setState('Not saved · retry');
          }
          report(error);
          throw error;
        }
      });
    void queue.current.catch(() => {});
  }
  function editSet(id: string, patch: Partial<SetRecord>) {
    persist({
      ...current.current,
      sets: current.current.sets.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        if (next.done && setProblem(current.current.exercise, next)) next.done = false;
        return next;
      }),
    });
  }
  function complete(p: Performance, s: SetRecord) {
    const problem = !s.done && setProblem(p.exercise, s);
    if (problem) return notify(problem);
    editSet(s.id, { done: !s.done });
    if (!s.done && settings.autoRest) void startRest(p.prescription.rest).catch(report);
  }
  async function continueWorkout() {
    setBusy(true);
    try {
      await queue.current;
      if (!(await db.sessions.get(initial.id))) await saveSession(initial);
      if (individual) {
        if (!workingSets(current.current).length)
          throw new Error('Complete at least one working set before finishing.');
        const saved = await db.sessions.get(initial.id);
        if (!saved) throw new Error('Session could not be found. Please retry saving.');
        await saveSession({ ...saved, status: 'completed', finishedAt: now() });
        notify('Session complete. Your progress is updated.');
        go('progress');
      } else go(`workout/${initial.id}/${exercise.id}`);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    discarding.current = true;
    try {
      await queue.current.catch(() => {});
      await discardDraftSession(initial.id);
      notify('Workout canceled. It was not counted as completed.');
      go('today');
    } catch (error) {
      discarding.current = false;
      throw error;
    }
  }
  const p = performance;
  return (
    <Section
      title="Log sets"
      aside={
        <span className={`save-indicator ${failed ? 'error' : ''}`} role="status">
          {state}
        </span>
      }
    >
      <div className="exercise-log card exercise-inline-log">
        <div className="inline-log-context">
          <span>{individual ? 'Single-exercise session' : initial.title}</span>
          <span>{initial.date}</span>
        </div>
        <p className="inline-prescription">
          {p.prescription.sets} ×{' '}
          {p.prescription.unit === 'submax'
            ? 'submaximal'
            : `${p.prescription.min}–${p.prescription.max} ${p.prescription.unit}`}
          {p.exercise.sides === 2 ? ' / side' : ''}
          <span> · {p.prescription.rest}s rest</span>
        </p>
        {(p.exercise.loadMode === 'per-hand' || p.exercise.type === 'assisted') && (
          <p className="small muted">
            {p.exercise.type === 'assisted'
              ? 'Enter machine assistance.'
              : 'Enter weight per hand.'}
          </p>
        )}
        {failed && (
          <button className="danger" onClick={() => persist(current.current)}>
            Retry saving current entries
          </button>
        )}
        {undo && (
          <button
            className="text-button"
            onClick={() => {
              persist(undo);
              setUndo(null);
            }}
          >
            <Undo2 size={16} />
            Undo deletion
          </button>
        )}
        <SetEditor
          performance={p}
          editSet={editSet}
          complete={complete}
          updatePerformance={(fn) => persist(fn(current.current))}
          removeSet={(id) => {
            setUndo(structuredClone(current.current));
            persist({ ...current.current, sets: current.current.sets.filter((s) => s.id !== id) });
          }}
        />
        <div className="compact-timer">
          <RestTimer />
        </div>
        <button
          className="primary full"
          disabled={busy || (individual && !workingSets(p).length)}
          onClick={() => void continueWorkout()}
        >
          {busy ? 'Saving…' : individual ? 'Finish session' : 'Open workout'}
          <ArrowUpRight size={17} />
        </button>
        {individual && (
          <button
            className="danger text-button cancel-workout"
            disabled={busy}
            onClick={() => setCanceling(true)}
          >
            Cancel workout
          </button>
        )}
        {canceling && (
          <DiscardWorkoutDialog
            title={initial.title}
            onClose={() => setCanceling(false)}
            onDiscard={discard}
          />
        )}
      </div>
    </Section>
  );
}
