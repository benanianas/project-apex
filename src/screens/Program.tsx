import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { db, restoreOriginal } from '../storage/db';
import { trainingRules } from '../data/program';
import {
  dateKey,
  now,
  programSchema,
  uid,
  type Program as ProgramType,
  type TrainingDay,
} from '../domain/model';
import { Field, Modal, PageTitle, Section, useData } from '../components/ui';
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function Program() {
  const { program, programs, settings, report, notify } = useData();
  const [editor, setEditor] = useState<ProgramType | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [archive, setArchive] = useState(false);
  async function select(id: string) {
    try {
      const p = programs.find((p) => p.id === id)!;
      await db.settings.update('settings', { programId: p.id, selectedDayId: p.days[0].id });
    } catch (e) {
      report(e);
    }
  }
  async function duplicate() {
    const p = {
      ...structuredClone(program),
      id: uid(),
      name: `${program.name} · copy`,
      block: 'Next block',
      startDate: dateKey(),
      archived: false,
      updatedAt: now(),
    };
    setEditor(p);
  }
  async function archiveCurrent() {
    try {
      const alternatives = programs.filter((p) => p.id !== program.id && !p.archived);
      if (!alternatives.length)
        throw new Error('Create or restore another program before archiving the active one.');
      await db.transaction('rw', [db.programs, db.settings], async () => {
        await db.programs.update(program.id, { archived: true, updatedAt: now() });
        await db.settings.update('settings', {
          programId: alternatives[0].id,
          selectedDayId: alternatives[0].days[0].id,
        });
      });
      setArchive(false);
      notify('Program archived. All history retained.');
    } catch (e) {
      report(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="TRAINING PLAN"
        title="Program"
        subtitle="A plan that moves with you."
        action={<button onClick={() => setEditor(program)}>Edit program</button>}
      />
      <div className="card program-overview">
        <Field label="Active program">
          <select value={settings.programId} onChange={(e) => void select(e.target.value)}>
            {programs
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.block}
                </option>
              ))}
          </select>
        </Field>
        <div>
          <span className="eyebrow">{program.block} BLOCK</span>
          <h2>{program.weeks} weeks of deliberate work.</h2>
          <p className="muted">
            Start date {program.startDate} · {program.days.length} training days · Days are not tied
            to weekdays unless you assign them.
          </p>
        </div>
      </div>
      <div className="schedule-list">
        {program.days.map((d, i) => (
          <div className="schedule-row" key={d.id}>
            <div className="schedule-number">
              <span>DAY</span>
              <strong>{String(i + 1).padStart(2, '0')}</strong>
            </div>
            <div>
              <span className="eyebrow">
                {d.kind}
                {d.weekday !== null ? ` / ${weekdays[d.weekday]}` : ''}
              </span>
              <h3>{d.title}</h3>
              <p>{d.focus}</p>
            </div>
            <div className="schedule-meta">
              <span>{d.duration}</span>
              <small>
                {d.kind === 'strength'
                  ? `${d.exercises.length} exercises · ${d.exercises.reduce((n, p) => n + p.sets, 0)} sets`
                  : d.kind === 'rest'
                    ? 'No structured training'
                    : d.kind === 'recovery'
                      ? 'Mobility & recovery'
                      : 'Aerobic work & rope'}
              </small>
            </div>
            <button onClick={() => setEditor(program)}>Edit</button>
          </div>
        ))}
      </div>
      <div className="button-row section">
        <button onClick={() => void duplicate()}>
          <Copy size={17} />
          Duplicate program / new block
        </button>
        <button
          onClick={() =>
            setEditor({
              id: uid(),
              name: 'My program',
              block: 'New block',
              weeks: 4,
              startDate: dateKey(),
              archived: false,
              days: [blankDay()],
              updatedAt: now(),
            })
          }
        >
          <Plus size={17} />
          New program
        </button>
        <button onClick={() => setRestoring(true)}>
          <RotateCcw size={16} />
          Restore original APEX
        </button>
        <button onClick={() => setArchive(true)}>Archive program</button>
      </div>
      <details className="section training-principles">
        <summary>Training principles</summary>
        <div className="principles-grid">
          {trainingRules.map((rule, i) => (
            <div className="card" key={rule}>
              <span className="eyebrow">0{i + 1}</span>
              <p>{rule}</p>
            </div>
          ))}
        </div>
      </details>
      {programs.some((p) => p.archived) && (
        <Section title="Archived programs">
          <div className="card">
            {programs
              .filter((p) => p.archived)
              .map((p) => (
                <div key={p.id} className="history-row">
                  <span>
                    {p.name} · {p.block}
                  </span>
                  <button
                    onClick={() =>
                      void db.programs
                        .update(p.id, { archived: false, updatedAt: now() })
                        .catch(report)
                    }
                  >
                    Unarchive
                  </button>
                </div>
              ))}
          </div>
        </Section>
      )}
      {editor && (
        <Modal title="Program editor" onClose={() => setEditor(null)}>
          <ProgramEditor key={editor.id} initial={editor} onSaved={() => setEditor(null)} />
        </Modal>
      )}
      {restoring && (
        <Modal title="Restore the original template?" onClose={() => setRestoring(false)}>
          <p>
            A fresh copy of the seven-day APEX foundation block will become active. Your current
            program and all workout history are retained.
          </p>
          <button
            className="primary"
            onClick={() =>
              void restoreOriginal()
                .then(() => {
                  setRestoring(false);
                  notify('Original APEX template restored as a new program.');
                })
                .catch(report)
            }
          >
            Restore original program
          </button>
        </Modal>
      )}
      {archive && (
        <Modal title="Archive this program?" onClose={() => setArchive(false)}>
          <p>Workout history stays available. Another unarchived program will become active.</p>
          <button onClick={() => void archiveCurrent()}>Archive and switch program</button>
        </Modal>
      )}
    </>
  );
}
function blankDay(): TrainingDay {
  return {
    id: uid(),
    title: 'New workout',
    kind: 'strength',
    duration: '45–60 min',
    focus: '',
    exercises: [],
    warmup: [],
    mobility: [],
    cardio: null,
    weekday: null,
  };
}
function ProgramEditor({ initial, onSaved }: { initial: ProgramType; onSaved: () => void }) {
  const { exercises, settings, report, notify } = useData();
  const [p, setP] = useState(structuredClone(initial));
  const [selected, setSelected] = useState(p.days[0].id);
  const [adding, setAdding] = useState('pull-up');
  const [saving, setSaving] = useState(false);
  const day = p.days.find((d) => d.id === selected) ?? p.days[0];
  const editDay = (patch: Partial<TrainingDay>) =>
    setP((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)),
    }));
  function moveDay(direction: number) {
    const days = [...p.days];
    const index = days.findIndex((d) => d.id === day.id);
    const to = index + direction;
    if (to < 0 || to >= days.length) return;
    [days[index], days[to]] = [days[to], days[index]];
    setP({ ...p, days });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const validated = programSchema.parse({ ...p, updatedAt: now() });
      await db.transaction('rw', [db.programs, db.settings], async () => {
        await db.programs.put(validated);
        await db.settings.update('settings', {
          programId: p.id,
          selectedDayId: p.days.some((d) => d.id === settings.selectedDayId)
            ? settings.selectedDayId
            : p.days[0].id,
        });
      });
      notify('Program saved. Existing sessions keep their original prescriptions.');
      onSaved();
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="form-stack program-editor" onSubmit={(e) => void save(e)}>
      <div className="form-grid">
        <Field label="Program name">
          <input
            value={p.name}
            required
            maxLength={160}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </Field>
        <Field label="Block name">
          <input
            value={p.block}
            required
            maxLength={160}
            onChange={(e) => setP({ ...p, block: e.target.value })}
          />
        </Field>
        <Field label="Block weeks">
          <input
            type="number"
            min={1}
            max={104}
            step={1}
            required
            value={p.weeks}
            onChange={(e) => setP({ ...p, weeks: +e.target.value })}
          />
        </Field>
        <Field label="Program start date">
          <input
            type="date"
            required
            value={p.startDate}
            onChange={(e) => setP({ ...p, startDate: e.target.value })}
          />
        </Field>
      </div>
      <hr />
      <Field label="Training day to edit">
        <select value={day.id} onChange={(e) => setSelected(e.target.value)}>
          {p.days.map((d, i) => (
            <option key={d.id} value={d.id}>
              Day {i + 1} · {d.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="button-row">
        <button type="button" onClick={() => moveDay(-1)} aria-label="Move day earlier">
          <ArrowUp size={16} />
        </button>
        <button type="button" onClick={() => moveDay(1)} aria-label="Move day later">
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            const d = blankDay();
            setP({ ...p, days: [...p.days, d] });
            setSelected(d.id);
          }}
        >
          Add day
        </button>
        <button
          type="button"
          onClick={() => {
            const d = {
              ...structuredClone(day),
              id: uid(),
              title: `${day.title} copy`,
              exercises: day.exercises.map((e) => ({ ...e, id: uid() })),
            };
            setP({ ...p, days: [...p.days, d] });
            setSelected(d.id);
          }}
        >
          Duplicate day
        </button>
        <button
          type="button"
          disabled={p.days.length === 1}
          onClick={() => {
            const days = p.days.filter((d) => d.id !== day.id);
            setP({ ...p, days });
            setSelected(days[0].id);
          }}
        >
          Remove day
        </button>
      </div>
      <div className="form-grid">
        <Field label="Workout title">
          <input
            required
            maxLength={160}
            value={day.title}
            onChange={(e) => editDay({ title: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <select
            value={day.kind}
            onChange={(e) =>
              editDay({
                kind: e.target.value as TrainingDay['kind'],
                cardio:
                  e.target.value === 'cardio'
                    ? (day.cardio ?? {
                        min: 30,
                        max: 35,
                        speedMin: null,
                        speedMax: null,
                        rpe: '3–4',
                        activity: 'Treadmill running',
                      })
                    : null,
              })
            }
          >
            {['strength', 'cardio', 'recovery', 'rest'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Expected duration">
          <input
            required
            maxLength={160}
            value={day.duration}
            onChange={(e) => editDay({ duration: e.target.value })}
          />
        </Field>
        <Field label="Optional weekday assignment">
          <select
            value={day.weekday ?? ''}
            onChange={(e) => editDay({ weekday: e.target.value === '' ? null : +e.target.value })}
          >
            <option value="">Unassigned · numbered day</option>
            {weekdays.map((d, i) => (
              <option value={i} key={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Training focus">
        <input
          value={day.focus}
          maxLength={10000}
          onChange={(e) => editDay({ focus: e.target.value })}
        />
      </Field>
      {day.cardio && (
        <div className="form-grid">
          {(['min', 'max'] as const).map((key) => (
            <Field key={key} label={`${key === 'min' ? 'Minimum' : 'Maximum'} cardio minutes`}>
              <input
                type="number"
                min={1}
                max={1440}
                value={day.cardio![key]}
                onChange={(e) => editDay({ cardio: { ...day.cardio!, [key]: +e.target.value } })}
              />
            </Field>
          ))}
          <Field label="Cardio modality">
            <input
              value={day.cardio.activity}
              onChange={(e) => editDay({ cardio: { ...day.cardio!, activity: e.target.value } })}
            />
          </Field>
          <Field label="Effort target">
            <input
              value={day.cardio.rpe}
              onChange={(e) => editDay({ cardio: { ...day.cardio!, rpe: e.target.value } })}
            />
          </Field>
        </div>
      )}
      {day.kind === 'strength' && (
        <>
          <h3>Exercise prescriptions</h3>
          {day.exercises.map((rx, i) => (
            <div className="rx-editor" key={rx.id}>
              <div className="section-heading">
                <strong>Exercise {i + 1}</strong>
                <div className="button-row">
                  {[-1, 1].map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className="icon-button"
                      disabled={i + dir < 0 || i + dir >= day.exercises.length}
                      aria-label={dir === -1 ? 'Move exercise earlier' : 'Move exercise later'}
                      onClick={() => {
                        const es = [...day.exercises];
                        [es[i], es[i + dir]] = [es[i + dir], es[i]];
                        editDay({ exercises: es });
                      }}
                    >
                      {dir === -1 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Remove prescription"
                    onClick={() =>
                      editDay({ exercises: day.exercises.filter((x) => x.id !== rx.id) })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <Field label="Movement or substitute">
                <select
                  value={rx.exerciseId}
                  onChange={(e) =>
                    editDay({
                      exercises: day.exercises.map((x) =>
                        x.id === rx.id ? { ...x, exerciseId: e.target.value } : x,
                      ),
                    })
                  }
                >
                  {exercises
                    .filter((e) => !e.archived || e.id === rx.exerciseId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="rx-fields">
                {(['sets', 'min', 'max', 'rest'] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === 'rest'
                        ? 'Rest (s)'
                        : key === 'min'
                          ? 'Lower'
                          : key === 'max'
                            ? 'Upper'
                            : 'Sets'
                    }
                  >
                    <input
                      type="number"
                      required
                      min={key === 'rest' ? 0 : 1}
                      max={key === 'sets' ? 50 : key === 'rest' ? 3600 : 10000}
                      step={1}
                      value={rx[key]}
                      onChange={(e) =>
                        editDay({
                          exercises: day.exercises.map((x) =>
                            x.id === rx.id ? { ...x, [key]: +e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Target unit">
                <select
                  value={rx.unit}
                  onChange={(e) =>
                    editDay({
                      exercises: day.exercises.map((x) =>
                        x.id === rx.id ? { ...x, unit: e.target.value as typeof rx.unit } : x,
                      ),
                    })
                  }
                >
                  {['reps', 'seconds', 'meters', 'submax'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
          ))}
          <div className="filter-row">
            <select
              aria-label="Exercise to add"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
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
              type="button"
              onClick={() => {
                const e = exercises.find((e) => e.id === adding)!;
                editDay({
                  exercises: [
                    ...day.exercises,
                    {
                      id: uid(),
                      exerciseId: adding,
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
                  ],
                });
              }}
            >
              <Plus size={16} />
              Add exercise
            </button>
          </div>
        </>
      )}
      {(['warmup', 'mobility'] as const).map((key) => (
        <Field
          key={key}
          label={`${key === 'warmup' ? 'Warm-up' : 'Mobility / flexibility'} · one item per line`}
        >
          <textarea
            value={day[key].join('\n')}
            onChange={(e) => editDay({ [key]: e.target.value ? e.target.value.split('\n') : [] })}
          />
        </Field>
      ))}
      <p className="muted small">
        Changes affect future workouts only. Active sessions and history retain their saved
        prescriptions.
      </p>
      <button className="primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save program'}
      </button>
    </form>
  );
}
