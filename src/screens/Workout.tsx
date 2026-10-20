import { useRef, useState } from 'react';
import { Plus, Check, Undo2, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import SetEditor from '../components/SetEditor';
import DiscardWorkoutDialog from '../components/DiscardWorkoutDialog';
import { discardDraftSession, saveSession } from '../storage/db';
import {
  newSet,
  now,
  uid,
  type Exercise,
  type Performance,
  type Session,
  type SetRecord,
} from '../domain/model';
import {
  exerciseHistory,
  fromKg,
  progression,
  rounded,
  sessionVolume,
  setProblem,
  workingSets,
} from '../domain/calculations';
import { findGuide } from '../data/exercises';
import ExerciseDiagram from '../components/ExerciseDiagram';
import RestTimer, { startRest } from '../components/RestTimer';
import { CardioForm, RopeForm } from '../components/ActivityForms';
import { Back, CheckRow, Field, go, Modal, PageTitle, Section, useData } from '../components/ui';
export default function Workout({ id, exerciseId }: { id: string; exerciseId?: string }) {
  const { sessions } = useData();
  const initial = sessions.find((s) => s.id === id);
  return initial ? (
    <Logger key={id} initial={initial} exerciseId={exerciseId} />
  ) : (
    <>
      <Back to="today" />
      <p>This session is not available.</p>
    </>
  );
}
function Logger({ initial, exerciseId }: { initial: Session; exerciseId?: string }) {
  const { settings, exercises, sessions, cardio, rope, report, notify } = useData();
  const [session, setSession] = useState(initial);
  const current = useRef(initial);
  const queue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const discarding = useRef(false);
  const [saveState, setSaveState] = useState('Saved on device');
  const [failed, setFailed] = useState(false);
  const [modal, setModal] = useState<'add' | 'cardio' | 'rope' | 'finish' | 'discard' | null>(null);
  const [undo, setUndo] = useState<Session | null>(null);
  const [picker, setPicker] = useState(exercises.find((e) => e.category !== 'mobility')?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [focusedId, setFocusedId] = useState(
    initial.performances.find((p) => p.exercise.id === exerciseId)?.id ??
      initial.performances.find((p) => p.sets.some((s) => !s.done && !s.warmup))?.id ??
      initial.performances[0]?.id,
  );
  const focusedIndex = Math.max(
    0,
    session.performances.findIndex((p) => p.id === focusedId),
  );
  const focused = session.performances[focusedIndex];
  function persist(next: Session) {
    if (discarding.current) return;
    const revision = ++saveRevision.current;
    current.current = next;
    setSession(next);
    setSaveState('Saving…');
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          await saveSession(next);
          if (revision === saveRevision.current) {
            setFailed(false);
            setSaveState('Saved on device');
          }
        } catch (e) {
          if (revision === saveRevision.current) {
            setFailed(true);
            setSaveState('Not saved · retry');
          }
          report(e);
          throw e;
        }
      });
    void queue.current.catch(() => {});
  }
  function update(patch: Partial<Session>) {
    persist({ ...current.current, ...patch, updatedAt: now() });
  }
  function updatePerformance(id: string, fn: (p: Performance) => Performance) {
    update({ performances: current.current.performances.map((p) => (p.id === id ? fn(p) : p)) });
  }
  function editSet(pid: string, sid: string, patch: Partial<SetRecord>) {
    updatePerformance(pid, (p) => ({
      ...p,
      sets: p.sets.map((s) => {
        if (s.id !== sid) return s;
        const updated = { ...s, ...patch };
        if (updated.done && setProblem(p.exercise, updated)) updated.done = false;
        return updated;
      }),
    }));
  }
  function complete(p: Performance, s: SetRecord) {
    if (!s.done) {
      const problem = setProblem(p.exercise, s);
      if (problem) {
        notify(problem);
        return;
      }
    }
    editSet(p.id, s.id, { done: !s.done });
    if (!s.done && settings.autoRest) void startRest(p.prescription.rest).catch(report);
  }
  function remove(fn: () => void) {
    setUndo(structuredClone(current.current));
    fn();
  }
  function addExercise(e: Exercise) {
    const p: Performance = {
      id: uid(),
      exercise: structuredClone(e),
      prescription: {
        id: uid(),
        exerciseId: e.id,
        sets: 3,
        min: e.type === 'carry' || e.type === 'timed' ? 30 : 8,
        max: e.type === 'carry' || e.type === 'timed' ? 45 : 12,
        unit:
          e.type === 'carry' || e.type === 'timed'
            ? 'seconds'
            : e.type === 'distance'
              ? 'meters'
              : 'reps',
        rest: 120,
        alternatives: e.alternatives,
      },
      sets: [newSet(), newSet(), newSet()],
    };
    update({ performances: [...current.current.performances, p] });
    setFocusedId(p.id);
    setModal(null);
  }
  async function finish() {
    setBusy(true);
    try {
      await queue.current;
      const s = current.current;
      const valid =
        s.kind !== 'strength' ||
        s.performances.some((p) => p.sets.some((x) => x.done && !x.warmup));
      if (!valid)
        throw new Error('Complete at least one working set before finishing. Your draft is safe.');
      if (s.kind === 'cardio' && !cardio.some((c) => c.sessionId === s.id && c.completed))
        throw new Error(
          'Save a completed cardio activity before finishing this conditioning session.',
        );
      await saveSession({ ...s, status: 'completed', finishedAt: s.finishedAt ?? now() });
      notify('Session complete. Every effort counts.');
      go('progress');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    discarding.current = true;
    try {
      // Drain pending autosaves before deletion so they cannot recreate the draft.
      await queue.current.catch(() => {});
      await discardDraftSession(current.current.id);
      notify('Workout canceled. It was not counted as completed.');
      go('today');
    } catch (error) {
      discarding.current = false;
      throw error;
    }
  }
  const completedSets = session.performances.reduce((n, p) => n + workingSets(p).length, 0);
  const total = session.performances.reduce(
    (n, p) => n + p.sets.filter((s) => !s.warmup).length,
    0,
  );
  return (
    <>
      <Back to="today" label="Back to Today" />
      <PageTitle
        eyebrow={session.status === 'completed' ? 'EDIT SAVED SESSION' : 'YOUR TRAINING SESSION'}
        title={session.title}
        subtitle="One exercise at a time."
        action={
          <span className={`save-indicator ${failed ? 'error' : ''}`} role="status">
            {saveState}
          </span>
        }
      />
      {failed && (
        <button className="danger" onClick={() => persist(current.current)}>
          Retry saving current entries
        </button>
      )}
      <details className="session-summary">
        <summary>
          <span>
            {session.kind === 'strength'
              ? `${completedSets} / ${total} sets · ${rounded(fromKg(sessionVolume(session), settings.weightUnit))} ${settings.weightUnit}·reps`
              : session.date}
          </span>
          <span>Session details</span>
        </summary>
        <Field label="Session date">
          <input
            type="date"
            value={session.date}
            onChange={(e) => {
              if (e.target.value) update({ date: e.target.value });
            }}
          />
        </Field>
      </details>
      <div className="compact-timer">
        <RestTimer />
      </div>
      {undo && (
        <div className="undo-bar">
          Removed from this session.
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
        </div>
      )}
      {session.warmup.length > 0 && (
        <details className="card workout-warmup">
          <summary>
            Warm-up{' '}
            <span>
              {session.warmup.filter((_, i) => session.checklist[`warm-${i}`]).length}/
              {session.warmup.length}
            </span>
          </summary>
          {session.warmup.map((label, i) => (
            <CheckRow
              key={i}
              label={label}
              checked={!!session.checklist[`warm-${i}`]}
              onChange={() =>
                update({
                  checklist: {
                    ...session.checklist,
                    [`warm-${i}`]: !session.checklist[`warm-${i}`],
                  },
                })
              }
              guide={
                findGuide(label, exercises)
                  ? () => go(`exercise/${findGuide(label, exercises)!.id}`)
                  : undefined
              }
            />
          ))}
        </details>
      )}
      {focused && (
        <div className="exercise-switcher">
          <div>
            <span className="eyebrow">
              EXERCISE {focusedIndex + 1} OF {session.performances.length}
            </span>
            <select
              aria-label="Current exercise"
              value={focused.id}
              onChange={(e) => setFocusedId(e.target.value)}
            >
              {session.performances.map((p, i) => (
                <option value={p.id} key={p.id}>
                  {i + 1}. {p.exercise.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="icon-button"
            aria-label="Previous exercise"
            disabled={focusedIndex === 0}
            onClick={() => setFocusedId(session.performances[focusedIndex - 1].id)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Next exercise"
            disabled={focusedIndex === session.performances.length - 1}
            onClick={() => setFocusedId(session.performances[focusedIndex + 1].id)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      {session.performances.map((p, index) => {
        const hist = exerciseHistory(
          p.exercise.id,
          sessions.filter((s) => s.id !== session.id),
        );
        const last = hist.at(-1)?.performance;
        const prior = hist.at(-2)?.performance;
        const advice = last ? progression(last, prior, settings.loadIncrementKg) : null;
        const load = ['resistance', 'assisted', 'weighted-bodyweight', 'carry'].includes(
          p.exercise.type,
        );
        return (
          <section className="exercise-log card" key={p.id} hidden={p.id !== focused?.id}>
            <div className="exercise-log-heading">
              <span className="row-number">{String(index + 1).padStart(2, '0')}</span>
              <ExerciseDiagram exercise={p.exercise} small />
              <div>
                <button
                  className="exercise-name-button"
                  onClick={() => go(`exercise/${p.exercise.id}`)}
                >
                  {p.exercise.name}
                  <ArrowUpRight size={14} />
                </button>
                <p>
                  {p.prescription.sets} ×{' '}
                  {p.prescription.unit === 'submax'
                    ? 'submaximal'
                    : `${p.prescription.min}–${p.prescription.max} ${p.prescription.unit}`}
                  {p.exercise.sides === 2 ? ' / side' : ''} ·{' '}
                  <button
                    className="text-button inline"
                    onClick={() => void startRest(p.prescription.rest).catch(report)}
                  >
                    {p.prescription.rest}s rest
                  </button>
                </p>
              </div>
            </div>
            <p className="muted small log-guidance">
              {p.exercise.category === 'heavy'
                ? 'Aim for 2–3 RIR.'
                : p.exercise.category === 'isolation'
                  ? 'Aim for 0–2 RIR.'
                  : 'Aim for 1–3 RIR.'}{' '}
              {p.exercise.type === 'assisted'
                ? 'Log machine assistance; lower assistance is harder.'
                : p.exercise.loadMode === 'per-hand'
                  ? 'Enter weight per hand.'
                  : load
                    ? 'Enter total load used.'
                    : ''}{' '}
              {p.exercise.sides === 2
                ? 'One row covers both sides; enter reps performed on each side.'
                : ''}
            </p>
            {last && (
              <div className="previous-line">
                Previous:{' '}
                {workingSets(last)
                  .map(
                    (s) =>
                      `${s.loadKg !== null ? `${rounded(fromKg(s.loadKg, settings.weightUnit))}${settings.weightUnit} × ` : ''}${s.reps ?? s.seconds ?? s.meters ?? '—'}${s.seconds !== null ? 's' : ''}`,
                  )
                  .join(' · ')}
              </div>
            )}
            <SetEditor
              performance={p}
              editSet={(sid, patch) => editSet(p.id, sid, patch)}
              complete={complete}
              removeSet={(sid) =>
                remove(() =>
                  updatePerformance(p.id, (old) => ({
                    ...old,
                    sets: old.sets.filter((s) => s.id !== sid),
                  })),
                )
              }
              updatePerformance={(fn) => updatePerformance(p.id, fn)}
            />
            {advice && (
              <details className="advice">
                <summary>{advice.title}</summary>
                <p>
                  {advice.detail}
                  {advice.nextKg !== undefined
                    ? ` Suggested next load: ${rounded(fromKg(advice.nextKg, settings.weightUnit), 2)} ${settings.weightUnit}${p.exercise.loadMode === 'per-hand' ? ' per hand' : ''}.`
                    : ''}
                </p>
              </details>
            )}
            <details className="session-adjust">
              <summary>Change this exercise for this session</summary>
              <p className="small muted">
                The program template and earlier logs stay as recorded. Substitution starts empty
                sets.
              </p>
              <select
                aria-label={`Replace ${p.exercise.name}`}
                value={p.exercise.id}
                onChange={(e) => {
                  const ex = exercises.find((x) => x.id === e.target.value)!;
                  setUndo(structuredClone(session));
                  updatePerformance(p.id, (old) => ({
                    ...old,
                    exercise: structuredClone(ex),
                    prescription: {
                      ...old.prescription,
                      exerciseId: ex.id,
                      unit:
                        ex.type === 'carry' || ex.type === 'timed'
                          ? 'seconds'
                          : ex.type === 'distance'
                            ? 'meters'
                            : 'reps',
                    },
                    sets: Array.from({ length: old.prescription.sets }, newSet),
                  }));
                }}
              >
                {exercises
                  .filter((e) => !e.archived)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
              <button
                className="danger text-button"
                onClick={() =>
                  remove(() =>
                    update({ performances: session.performances.filter((ep) => ep.id !== p.id) }),
                  )
                }
              >
                Remove exercise
              </button>
            </details>
          </section>
        );
      })}
      {focused && focusedIndex < session.performances.length - 1 && (
        <button
          className="next-exercise-button"
          onClick={() => {
            setFocusedId(session.performances[focusedIndex + 1].id);
            document
              .querySelector('.exercise-switcher')
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }}
        >
          <span>
            <small>UP NEXT</small>
            {session.performances[focusedIndex + 1].exercise.name}
          </span>
          <ChevronRight size={20} />
        </button>
      )}
      {session.kind === 'strength' && (
        <button className="secondary full-width" onClick={() => setModal('add')}>
          <Plus size={17} />
          Add exercise to this session
        </button>
      )}
      {session.kind === 'cardio' && (
        <Section title="Conditioning">
          <div className="two-grid">
            <div className="card">
              <h3>Aerobic training</h3>
              {cardio
                .filter((c) => c.sessionId === session.id)
                .map((c) => (
                  <p key={c.id}>
                    {c.completed ? '✓' : 'Draft'} {c.minutes} min · {c.activity}
                  </p>
                ))}
              <button className="primary" onClick={() => setModal('cardio')}>
                Log cardio
              </button>
            </div>
            <div className="card">
              <h3>Jump rope</h3>
              {rope
                .filter((r) => r.sessionId === session.id)
                .map((r) => (
                  <p key={r.id}>
                    {r.completed ? '✓' : 'Draft'} {r.rounds} × {r.workSeconds}s
                  </p>
                ))}
              <button onClick={() => setModal('rope')}>Log jump rope</button>
            </div>
          </div>
          <p className="muted small">Saved activities can be edited from Progress → History.</p>
        </Section>
      )}
      {session.mobility.length > 0 && (
        <Section title="Mobility & flexibility">
          <div className="card">
            {session.mobility.map((label, i) => (
              <CheckRow
                key={i}
                label={label}
                checked={!!session.checklist[`mobility-${i}`]}
                onChange={() =>
                  update({
                    checklist: {
                      ...session.checklist,
                      [`mobility-${i}`]: !session.checklist[`mobility-${i}`],
                    },
                  })
                }
                guide={
                  findGuide(label, exercises)
                    ? () => go(`exercise/${findGuide(label, exercises)!.id}`)
                    : undefined
                }
              />
            ))}
          </div>
        </Section>
      )}
      <div className="card section">
        <Field label="Session notes">
          <textarea
            value={session.notes}
            maxLength={10000}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Energy, technique, anything to remember…"
          />
        </Field>
      </div>
      <div className="finish-bar">
        {session.status === 'draft' ? (
          <button className="danger cancel-workout" onClick={() => setModal('discard')}>
            Cancel workout
          </button>
        ) : (
          <span>{completedSets} working sets saved</span>
        )}
        <button className="primary" onClick={() => setModal('finish')}>
          {session.status === 'completed' ? 'Save session edits' : 'Finish workout'}
          <Check size={18} />
        </button>
      </div>
      {modal === 'discard' && (
        <DiscardWorkoutDialog
          title={session.title}
          onClose={() => setModal(null)}
          onDiscard={discard}
        />
      )}
      {modal === 'add' && (
        <Modal title="Add an exercise" onClose={() => setModal(null)}>
          <Field label="Exercise">
            <select value={picker} onChange={(e) => setPicker(e.target.value)}>
              {exercises
                .filter((e) => !e.archived)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="primary"
            onClick={() => addExercise(exercises.find((e) => e.id === picker)!)}
          >
            Add exercise
          </button>
        </Modal>
      )}
      {modal === 'cardio' && (
        <Modal title="Log cardio" onClose={() => setModal(null)}>
          <CardioForm sessionId={session.id} onSaved={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'rope' && (
        <Modal title="Log jump rope" onClose={() => setModal(null)}>
          <RopeForm sessionId={session.id} onSaved={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'finish' && (
        <Modal title="Finish this session?" onClose={() => setModal(null)}>
          <p>
            {session.kind === 'strength'
              ? `${completedSets} of ${total} working sets are complete. Incomplete sets remain in the record and are excluded from analytics.`
              : 'Your saved activities and mobility checklist will be retained.'}
          </p>
          <p className="muted">You can edit this session later in Progress.</p>
          <button className="primary" disabled={busy || failed} onClick={() => void finish()}>
            {busy ? 'Saving…' : 'Confirm finish'}
          </button>
        </Modal>
      )}
    </>
  );
}
