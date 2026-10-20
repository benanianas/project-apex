import { lazy, Suspense, useState } from 'react';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { db } from '../storage/db';
import { exerciseSchema, uid, type Exercise } from '../domain/model';
import {
  estimate1RM,
  exerciseHistory,
  exercisePoints,
  fromKg,
  inRange,
  performanceVolume,
  progression,
  rounded,
  workingSets,
} from '../domain/calculations';
import ExerciseLogPanel from '../components/ExerciseLogPanel';
import ExerciseDiagram from '../components/ExerciseDiagram';
import { Back, Empty, Field, go, Modal, PageTitle, Section, Stat, useData } from '../components/ui';
const Chart = lazy(() => import('../components/Chart'));
export default function Exercises({ id, info = false }: { id?: string; info?: boolean }) {
  const { exercises, sessions } = useData();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All muscles');
  const [type, setType] = useState('All movements');
  const [equipment, setEquipment] = useState('All equipment');
  const [creating, setCreating] = useState(false);
  const exercise =
    exercises.find((e) => e.id === id) ??
    sessions.flatMap((s) => s.performances).find((p) => p.exercise.id === id)?.exercise;
  if (id)
    return exercise ? (
      <ExerciseDetail key={`${id}-${info}`} exercise={exercise} info={info} />
    ) : (
      <>
        <Back />
        <Empty title="Exercise not found">Choose a movement from the library.</Empty>
      </>
    );
  const filtered = exercises.filter(
    (e) =>
      !e.archived &&
      `${e.name} ${e.primary} ${e.secondary.join(' ')} ${e.equipment} ${e.pattern}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (muscle === 'All muscles' || e.primary === muscle) &&
      (type === 'All movements' || e.pattern === type) &&
      (equipment === 'All equipment' || e.equipment === equipment),
  );
  return (
    <>
      <PageTitle
        eyebrow="MOVEMENT LIBRARY"
        title="Exercises"
        subtitle={`${exercises.filter((e) => !e.archived).length} guides, always with you.`}
        action={
          <button onClick={() => setCreating(true)}>
            <Plus size={17} />
            New exercise
          </button>
        }
      />
      <div className="library-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search exercises"
            placeholder="Search movements, muscles, equipment…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="filter-row">
          <select
            aria-label="Filter muscle"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            {['All muscles', ...new Set(exercises.map((e) => e.primary))].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            aria-label="Filter movement"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['All movements', ...new Set(exercises.map((e) => e.pattern))].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            aria-label="Filter equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            {['All equipment', ...new Set(exercises.map((e) => e.equipment))].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="library-grid">
        {filtered.map((e) => (
          <button
            key={e.id}
            className="library-card"
            aria-label={`Open ${e.name}`}
            onClick={() => go(`exercise/${e.id}`)}
          >
            <div className="library-visual">
              <ExerciseDiagram exercise={e} />
              <ArrowUpRight size={18} />
            </div>
            <div>
              <span className="eyebrow">{e.primary}</span>
              <h3>{e.name}</h3>
              <p>{e.equipment}</p>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty title="No matching movements">
          Try another muscle, piece of equipment, or exercise name.
        </Empty>
      )}
      {creating && (
        <Modal title="Create an exercise" onClose={() => setCreating(false)}>
          <ExerciseEditor onSaved={() => setCreating(false)} />
        </Modal>
      )}
    </>
  );
}
function ExerciseDetail({ exercise: e, info }: { exercise: Exercise; info: boolean }) {
  const { settings, sessions, exercises, programs, report, notify } = useData();
  const [range, setRange] = useState(12);
  const [metric, setMetric] = useState(
    e.type === 'resistance'
      ? 'volume'
      : e.type === 'timed' || e.type === 'carry'
        ? 'seconds'
        : e.type === 'distance'
          ? 'meters'
          : e.type === 'assisted'
            ? 'load'
            : 'reps',
  );
  const [editing, setEditing] = useState(false);
  const hist = exerciseHistory(e.id, sessions);
  const last = hist.at(-1)?.performance;
  const prior = hist.at(-2)?.performance;
  const advice = last ? progression(last, prior, settings.loadIncrementKg) : null;
  const sets = hist.flatMap((x) => workingSets(x.performance));
  const maxLoad = Math.max(0, ...sets.map((s) => s.loadKg ?? 0));
  const minAssist = sets.filter((s) => s.loadKg !== null).length
    ? Math.min(...sets.filter((s) => s.loadKg !== null).map((s) => s.loadKg!))
    : null;
  const bestVolume = Math.max(0, ...hist.map((x) => performanceVolume(x.performance) ?? 0));
  const estimate = Math.max(0, ...sets.map((s) => estimate1RM(e, s) ?? 0));
  const prescriptions = programs
    .filter((p) => !p.archived)
    .flatMap((p) =>
      p.days.flatMap((d) =>
        d.exercises
          .filter((rx) => rx.exerciseId === e.id || rx.alternatives.includes(e.id))
          .map((rx) => ({ day: d.title, rx })),
      ),
    );
  const metrics = [
    ...(e.type === 'resistance'
      ? [
          ['volume', 'Volume'],
          ['load', 'Load'],
          ['estimate', 'Estimated 1RM'],
        ]
      : e.type === 'assisted'
        ? [['load', 'Assistance']]
        : e.type === 'weighted-bodyweight'
          ? [['load', 'Added load']]
          : []),
    ...(['timed', 'carry'].includes(e.type) ? [['seconds', 'Active duration']] : []),
    ...(['carry', 'distance'].includes(e.type) ? [['meters', 'Distance']] : []),
    ...(!['carry', 'timed', 'distance'].includes(e.type) ? [['reps', 'Total repetitions']] : []),
  ];
  const points = exercisePoints(e.id, sessions, metric)
    .filter((p) => inRange(p.date, range))
    .map((p) => ({
      ...p,
      value: ['volume', 'load', 'estimate'].includes(metric)
        ? fromKg(p.value, settings.weightUnit)
        : p.value,
    }));
  const unit =
    metric === 'volume'
      ? `${settings.weightUnit}·reps`
      : ['load', 'estimate'].includes(metric)
        ? settings.weightUnit
        : metric === 'seconds'
          ? 'seconds'
          : metric === 'meters'
            ? 'meters'
            : 'reps';
  return (
    <>
      <Back
        to={info ? `exercise/${e.id}` : 'exercises'}
        label={info ? 'Back to logging' : 'Exercises'}
      />
      <PageTitle
        eyebrow={info ? 'EXERCISE INFO' : ''}
        title={e.name}
        subtitle={info ? e.equipment : undefined}
        action={
          info && e.custom ? (
            <button onClick={() => setEditing(true)}>Edit guide</button>
          ) : undefined
        }
      />
      {!info && <ExerciseLogPanel exercise={e} />}
      {info && (
        <div className="detail-layout">
          <div>
            <div className="detail-visual">
              <ExerciseDiagram exercise={e} />
              <div>
                <span className="eyebrow">MOVEMENT GUIDE</span>
                <p>
                  {e.type.replaceAll('-', ' ')}
                  {e.loadMode === 'per-hand' ? ' · weight per hand' : ''}
                  {e.sides === 2 ? ' · reps per side' : ''}
                </p>
                <small>Original movement schematic · use alongside the instructions.</small>
              </div>
            </div>
            <Section title="How to perform">
              <ol className="instruction-list">
                {e.steps.map((step, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </Section>
            <div className="two-grid">
              <div className="card">
                <h3>Keep in mind</h3>
                {e.cues.map((c) => (
                  <p key={c}>{c}</p>
                ))}
              </div>
              <div className="card">
                <h3>Common mistakes</h3>
                {e.mistakes.map((c) => (
                  <p key={c} className="muted">
                    {c}
                  </p>
                ))}
              </div>
            </div>
            <Section title="Train with control">
              <p className="muted">{e.safety}</p>
            </Section>
            <a
              className="external-link"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} exercise technique demonstration`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Search video demonstrations <ArrowUpRight size={17} />
              <span>Online · YouTube search, not a verified direct video</span>
            </a>
          </div>
          <aside>
            <div className="card">
              <h3>Muscles & setup</h3>
              <p>
                <span className="muted">Primary</span>
                <br />
                {e.primary}
              </p>
              <p>
                <span className="muted">Secondary</span>
                <br />
                {e.secondary.join(', ') || 'Not specified'}
              </p>
              <p>
                <span className="muted">Equipment</span>
                <br />
                {e.equipment}
              </p>
              {prescriptions.length > 0 && (
                <>
                  <h3>In your program</h3>
                  {prescriptions.map(({ day, rx }, i) => (
                    <p key={i}>
                      {day}
                      <br />
                      <span className="muted">
                        {rx.sets} ×{' '}
                        {rx.unit === 'submax' ? 'submaximal' : `${rx.min}–${rx.max} ${rx.unit}`}
                      </span>
                    </p>
                  ))}
                </>
              )}
            </div>
            {e.alternatives.length > 0 && (
              <Section title="Alternatives">
                <div className="card">
                  {e.alternatives.map((id) => {
                    const alt = exercises.find((x) => x.id === id);
                    return (
                      alt && (
                        <button
                          key={id}
                          className="alternative"
                          onClick={() => go(`exercise/${id}`)}
                        >
                          {alt.name}
                          <ArrowUpRight size={14} />
                        </button>
                      )
                    );
                  })}
                </div>
              </Section>
            )}
          </aside>
        </div>
      )}
      {!info && (
        <>
          <Section
            title="Your progress"
            aside={
              <select
                aria-label="Exercise date range"
                value={range}
                onChange={(ev) => setRange(+ev.target.value)}
              >
                <option value={4}>Last 4 weeks</option>
                <option value={12}>Last 12 weeks</option>
                <option value={0}>All time</option>
              </select>
            }
          >
            <div className="card">
              <div className="filter-row">
                {metrics.map(([key, label]) => (
                  <button
                    className={metric === key ? 'selected' : ''}
                    onClick={() => setMetric(key)}
                    key={key}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Suspense fallback={<p>Loading chart…</p>}>
                <Chart
                  data={points}
                  label={metrics.find((m) => m[0] === metric)?.[1] ?? 'Progress'}
                  unit={unit}
                />
              </Suspense>
              <p className="small muted">
                {metric === 'volume'
                  ? 'Completed working sets only. Warm-ups excluded. Combined external load × repetitions across both sides.'
                  : metric === 'estimate'
                    ? 'Epley estimate from eligible 1–10 rep compound sets; not a tested maximum.'
                    : metric === 'load' && e.type === 'assisted'
                      ? 'Lower assistance indicates less machine support. Compare on the same machine.'
                      : 'Only this exercise variant is included. Compare like equipment, technique and measurement conventions.'}
              </p>
            </div>
          </Section>
          {hist.length > 0 && (
            <>
              <div className="stat-grid records card">
                <Stat
                  label={e.type === 'assisted' ? 'Lowest assistance' : 'Heaviest working load'}
                  value={
                    e.type === 'assisted' && minAssist !== null
                      ? rounded(fromKg(minAssist, settings.weightUnit))
                      : maxLoad
                        ? rounded(fromKg(maxLoad, settings.weightUnit))
                        : '—'
                  }
                  unit={settings.weightUnit}
                />
                {e.type === 'resistance' ? (
                  <Stat
                    label="Best session volume"
                    value={rounded(fromKg(bestVolume, settings.weightUnit))}
                    unit={`${settings.weightUnit}·reps`}
                  />
                ) : (
                  <Stat
                    label="Best repetitions"
                    value={Math.max(0, ...sets.map((s) => s.reps ?? 0))}
                  />
                )}
                <Stat
                  label={['carry', 'timed'].includes(e.type) ? 'Longest set' : 'Estimated strength'}
                  value={
                    ['carry', 'timed'].includes(e.type)
                      ? Math.max(0, ...sets.map((s) => s.seconds ?? 0))
                      : estimate
                        ? rounded(fromKg(estimate, settings.weightUnit))
                        : '—'
                  }
                  unit={['carry', 'timed'].includes(e.type) ? 's' : settings.weightUnit}
                />
              </div>
              {advice && (
                <div className="advice card">
                  <h3>{advice.title}</h3>
                  <p>{advice.detail}</p>
                  {advice.nextKg !== undefined && (
                    <p>
                      Optional next load: {rounded(fromKg(advice.nextKg, settings.weightUnit), 2)}{' '}
                      {settings.weightUnit}
                      {e.loadMode === 'per-hand' ? ' per hand' : ''}.
                    </p>
                  )}
                </div>
              )}
              <Section title="Session history">
                <div className="card">
                  {[...hist].reverse().map(({ session, performance }, i) => (
                    <button
                      className="history-row"
                      key={`${session.id}-${i}`}
                      onClick={() => go(`workout/${session.id}`)}
                    >
                      <span>
                        {session.date}
                        <small>{session.title}</small>
                      </span>
                      <span>
                        {workingSets(performance)
                          .map(
                            (s) =>
                              `${s.loadKg !== null ? `${rounded(fromKg(s.loadKg, settings.weightUnit))} ${settings.weightUnit} × ` : ''}${s.reps ?? s.seconds ?? s.meters ?? 0}${s.seconds !== null ? 's' : ''}`,
                          )
                          .join(' / ')}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
              <details className="card">
                <summary>Best reps at each load</summary>
                {[...new Set(sets.map((s) => s.loadKg))].map((load) => (
                  <p key={String(load)}>
                    {load === null
                      ? 'Bodyweight'
                      : `${rounded(fromKg(load, settings.weightUnit))} ${settings.weightUnit}`}
                    : {Math.max(...sets.filter((s) => s.loadKg === load).map((s) => s.reps ?? 0))}{' '}
                    reps
                  </p>
                ))}
              </details>
            </>
          )}
          <button className="exercise-info-link" onClick={() => go(`exercise-info/${e.id}`)}>
            <span>
              <strong>Exercise info</strong>
              <small>Technique, muscles & alternatives</small>
            </span>
            <ArrowUpRight size={20} />
          </button>
        </>
      )}
      {info && e.custom && (
        <button
          className="text-button danger section"
          onClick={() =>
            void db.exercises
              .update(e.id, { archived: !e.archived })
              .then(() => {
                notify(
                  e.archived
                    ? 'Exercise restored to library.'
                    : 'Exercise archived; history and program references are retained.',
                );
                go('exercises');
              })
              .catch(report)
          }
        >
          {e.archived ? 'Unarchive exercise' : 'Archive exercise'}
        </button>
      )}
      {editing && (
        <Modal title="Edit custom exercise" onClose={() => setEditing(false)}>
          <ExerciseEditor existing={e} onSaved={() => setEditing(false)} />
        </Modal>
      )}
    </>
  );
}
export function ExerciseEditor({
  existing,
  onSaved,
}: {
  existing?: Exercise;
  onSaved: () => void;
}) {
  const { exercises, notify, report } = useData();
  const [form, setForm] = useState<Exercise>(
    existing ?? {
      id: uid(),
      name: '',
      pattern: 'Custom movement',
      primary: '',
      secondary: [],
      equipment: '',
      type: 'resistance',
      loadMode: 'total',
      sides: 1,
      category: 'compound',
      diagram: 'Warm-up',
      steps: [''],
      cues: [],
      mistakes: [],
      safety: 'Use controlled technique and a comfortable range.',
      alternatives: [],
      custom: true,
      archived: false,
    },
  );
  const edit = (patch: Partial<Exercise>) => setForm((f) => ({ ...f, ...patch }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const variant =
        existing &&
        (existing.type !== form.type ||
          existing.sides !== form.sides ||
          existing.loadMode !== form.loadMode);
      const parsed = exerciseSchema.parse({
        ...form,
        id: variant ? uid() : form.id,
        secondary: form.secondary.filter(Boolean),
        steps: form.steps.filter(Boolean),
        cues: form.cues.filter(Boolean),
        mistakes: form.mistakes.filter(Boolean),
      });
      await db.exercises.put(parsed);
      notify(
        variant
          ? 'Logging convention changed: saved as a new exercise identity to keep comparisons separate.'
          : 'Exercise saved. Historical snapshots remain unchanged.',
      );
      onSaved();
    } catch (e) {
      report(e);
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="form-stack">
      <div className="form-grid">
        <Field label="Exercise name">
          <input
            required
            value={form.name}
            onChange={(e) => edit({ name: e.target.value })}
            maxLength={160}
          />
        </Field>
        <Field label="Primary muscle">
          <input
            required
            value={form.primary}
            onChange={(e) => edit({ primary: e.target.value })}
          />
        </Field>
        <Field label="Secondary muscles (comma separated)">
          <input
            value={form.secondary.join(', ')}
            onChange={(e) => edit({ secondary: e.target.value.split(',').map((s) => s.trim()) })}
          />
        </Field>
        <Field label="Equipment">
          <input
            required
            value={form.equipment}
            onChange={(e) => edit({ equipment: e.target.value })}
          />
        </Field>
        <Field label="Movement pattern">
          <input
            required
            value={form.pattern}
            onChange={(e) => edit({ pattern: e.target.value })}
          />
        </Field>
        <Field label="Logging type">
          <select
            value={form.type}
            onChange={(e) => edit({ type: e.target.value as Exercise['type'] })}
          >
            {[
              'resistance',
              'bodyweight',
              'assisted',
              'weighted-bodyweight',
              'timed',
              'carry',
              'distance',
            ].map((t) => (
              <option key={t} value={t}>
                {t.replaceAll('-', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Load convention">
          <select
            value={form.loadMode}
            onChange={(e) => edit({ loadMode: e.target.value as Exercise['loadMode'] })}
          >
            <option value="total">Total external load</option>
            <option value="per-hand">Per hand · two implements</option>
          </select>
        </Field>
        <Field label="Repetition convention">
          <select value={form.sides} onChange={(e) => edit({ sides: +e.target.value as 1 | 2 })}>
            <option value={1}>Bilateral / total repetitions</option>
            <option value={2}>Each side · one row covers both</option>
          </select>
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => edit({ category: e.target.value as Exercise['category'] })}
          >
            {['heavy', 'compound', 'isolation', 'mobility', 'conditioning'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Movement schematic">
          <select value={form.diagram} onChange={(e) => edit({ diagram: e.target.value })}>
            {['Warm-up', ...new Set(exercises.map((e) => e.diagram))]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </Field>
      </div>
      {(['steps', 'cues', 'mistakes'] as const).map((key) => (
        <Field
          key={key}
          label={`${key === 'steps' ? 'Instructions' : key === 'cues' ? 'Technique cues' : 'Common mistakes'} · one per line`}
        >
          <textarea
            required={key === 'steps'}
            value={form[key].join('\n')}
            onChange={(e) => edit({ [key]: e.target.value.split('\n') })}
          />
        </Field>
      ))}
      <Field label="Safety considerations">
        <textarea value={form.safety} onChange={(e) => edit({ safety: e.target.value })} />
      </Field>
      <Field label="Alternatives (select any)">
        <select
          multiple
          value={form.alternatives}
          onChange={(e) =>
            edit({ alternatives: [...e.target.selectedOptions].map((o) => o.value) })
          }
        >
          {exercises
            .filter((e) => e.id !== form.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </Field>
      <button className="primary">Save exercise</button>
    </form>
  );
}
