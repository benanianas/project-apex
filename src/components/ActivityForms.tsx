import { useEffect, useRef, useState } from 'react';
import { db } from '../storage/db';
import {
  cardioSchema,
  dateKey,
  now,
  ropeSchema,
  uid,
  type Cardio,
  type Rope,
} from '../domain/model';
import { cardioDistance, fromKm, fromKmh, rounded, toKm, toKmh } from '../domain/calculations';
import { ropeStages } from '../data/program';
import { Field, useData } from './ui';
const modalities = [
  'Treadmill running',
  'Outdoor running',
  'Incline walking',
  'Cycling',
  'Elliptical',
  'Other cardio',
];
type Fields = Record<string, string>;
const nullable = (s: string) => (s === '' ? null : Number(s));
function useFormDraft(id: string, initial: Fields) {
  const [fields, setFields] = useState(initial);
  const fieldsRef = useRef(initial);
  const [loaded, setLoaded] = useState(false);
  const { report } = useData();
  useEffect(() => {
    let cancelled = false;
    void db.drafts
      .get(id)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          fieldsRef.current = { ...initial, ...d.fields };
          setFields(fieldsRef.current);
        }
        setLoaded(true);
      })
      .catch((e) => {
        report(e);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    }; /* Initial values are captured once per keyed form. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  function change(key: string, value: string) {
    const next = { ...fieldsRef.current, [key]: value };
    fieldsRef.current = next;
    setFields(next);
    void db.drafts.put({ id, fields: next, updatedAt: now() }).catch(report);
  }
  return {
    fields,
    change,
    loaded,
    reset: async () => {
      await db.drafts.delete(id);
    },
  };
}
function Input({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 'any',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  min?: number;
  max?: number;
  step?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode={step === '1' ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        step={step}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional"
      />
    </Field>
  );
}
export function CardioForm({
  sessionId = null,
  existing,
  onSaved,
}: {
  sessionId?: string | null;
  existing?: Cardio;
  onSaved: () => void;
}) {
  const { settings, program, sessions, notify, report } = useData();
  const session = sessions.find((s) => s.id === sessionId);
  const day = program.days.find((d) => d.id === session?.dayId);
  const draftId = existing ? `cardio-edit-${existing.id}` : `cardio-${sessionId ?? 'new'}`;
  const [saving, setSaving] = useState(false);
  const [recordId] = useState(() => existing?.id ?? uid());
  const {
    fields: f,
    change: c,
    loaded,
    reset,
  } = useFormDraft(draftId, {
    date: existing?.date ?? dateKey(),
    activity: existing?.activity ?? day?.cardio?.activity ?? 'Treadmill running',
    minutes: existing ? String(existing.minutes) : '',
    speed:
      existing?.speedKmh != null
        ? String(rounded(fromKmh(existing.speedKmh, settings.speedUnit), 3))
        : '',
    distance:
      existing?.distanceKm != null
        ? String(rounded(fromKm(existing.distanceKm, settings.distanceUnit), 3))
        : '',
    incline: existing?.incline?.toString() ?? '',
    rpe: existing?.rpe?.toString() ?? '',
    heartRate: existing?.heartRate?.toString() ?? '',
    notes: existing?.notes ?? '',
    completed: existing ? String(existing.completed) : 'true',
    speedUnit: settings.speedUnit,
    distanceUnit: settings.distanceUnit,
  });
  const speed = f.speed === '' ? null : toKmh(Number(f.speed), f.speedUnit as 'mph' | 'km/h');
  const distance =
    f.distance === '' ? null : toKm(Number(f.distance), f.distanceUnit as 'mi' | 'km');
  const derived = cardioDistance(speed, Number(f.minutes), distance);
  const pace =
    derived && Number(f.minutes) > 0
      ? Number(f.minutes) / fromKm(derived, f.distanceUnit as 'mi' | 'km')
      : null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = cardioSchema.safeParse({
        id: recordId,
        sessionId: existing?.sessionId ?? sessionId,
        date: f.date,
        activity: f.activity,
        minutes: Number(f.minutes),
        speedKmh: speed,
        distanceKm: distance,
        incline: nullable(f.incline),
        rpe: nullable(f.rpe),
        heartRate: nullable(f.heartRate),
        notes: f.notes,
        completed: f.completed === 'true',
        updatedAt: now(),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await db.cardio.put(parsed.data);
      await reset();
      notify('Cardio saved on this device.');
      onSaved();
    } catch (error) {
      report(error);
    } finally {
      setSaving(false);
    }
  }
  if (!loaded) return <p>Restoring cardio draft…</p>;
  return (
    <form className="form-stack" onSubmit={(e) => void submit(e)}>
      <p className="muted small">
        Target: {day?.cardio?.min ?? 30}–{day?.cardio?.max ?? 35} minutes at conversational RPE 3–4.
        Enter what you actually completed. Draft entries autosave.
      </p>
      <div className="form-grid">
        <Field label="Date">
          <input type="date" value={f.date} required onChange={(e) => c('date', e.target.value)} />
        </Field>
        <Field label="Activity">
          <select
            value={modalities.includes(f.activity) ? f.activity : 'Custom'}
            onChange={(e) =>
              c('activity', e.target.value === 'Custom' ? 'Custom cardio' : e.target.value)
            }
          >
            {modalities.map((m) => (
              <option key={m}>{m}</option>
            ))}
            <option>Custom</option>
          </select>
        </Field>
        {!modalities.includes(f.activity) && (
          <Field label="Custom activity name">
            <input
              value={f.activity}
              required
              maxLength={160}
              onChange={(e) => c('activity', e.target.value)}
            />
          </Field>
        )}
        <Input
          label="Duration (minutes)"
          value={f.minutes}
          onChange={(v) => c('minutes', v)}
          min={0.01}
          max={1440}
          required
        />
        <Input
          label={`Average speed (${f.speedUnit})`}
          value={f.speed}
          onChange={(v) => c('speed', v)}
        />
        <Input
          label={`Distance (${f.distanceUnit}) · optional override`}
          value={f.distance}
          onChange={(v) => c('distance', v)}
        />
        <Input
          label="Incline (%)"
          value={f.incline}
          onChange={(v) => c('incline', v)}
          min={-30}
          max={40}
        />
        <Input label="RPE (1–10)" value={f.rpe} onChange={(v) => c('rpe', v)} min={1} max={10} />
        <Input
          label="Average heart rate (bpm)"
          value={f.heartRate}
          onChange={(v) => c('heartRate', v)}
          min={20}
          max={250}
          step="1"
        />
      </div>
      {derived !== null && Number(f.minutes) > 0 && (
        <div className="info-line">
          {f.distance ? 'Entered' : 'Calculated'} distance:{' '}
          {rounded(fromKm(derived, f.distanceUnit as 'mi' | 'km'), 2)} {f.distanceUnit}
          {pace !== null && /running|walking/i.test(f.activity)
            ? ` · Pace ${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} / ${f.distanceUnit}`
            : ''}
        </div>
      )}
      <Field label="Notes">
        <textarea value={f.notes} onChange={(e) => c('notes', e.target.value)} maxLength={10000} />
      </Field>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={f.completed === 'true'}
          onChange={(e) => c('completed', String(e.target.checked))}
        />
        Activity completed (only completed activities enter analytics)
      </label>
      <button className="primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save cardio'}
      </button>
    </form>
  );
}
export function RopeForm({
  sessionId = null,
  existing,
  onSaved,
}: {
  sessionId?: string | null;
  existing?: Rope;
  onSaved: () => void;
}) {
  const { settings, rope, notify, report } = useData();
  const stage = ropeStages[settings.ropeStage];
  const [saving, setSaving] = useState(false);
  const [recordId] = useState(() => existing?.id ?? uid());
  const {
    fields: f,
    change: c,
    loaded,
    reset,
  } = useFormDraft(existing ? `rope-edit-${existing.id}` : `rope-${sessionId ?? 'new'}`, {
    date: existing?.date ?? dateKey(),
    rounds: existing ? String(existing.rounds) : '',
    work: existing ? String(existing.workSeconds) : String(stage.work),
    rest: existing ? String(existing.restSeconds) : '60',
    elapsed: existing?.elapsedSeconds?.toString() ?? '',
    rpe: existing?.rpe?.toString() ?? '',
    tolerance: existing?.tolerance ?? 'unknown',
    notes: existing?.notes ?? '',
    completed: existing ? String(existing.completed) : 'true',
  });
  const recent = [...rope]
    .filter((r) => r.completed)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = ropeSchema.safeParse({
        id: recordId,
        sessionId: existing?.sessionId ?? sessionId,
        date: f.date,
        rounds: Number(f.rounds),
        workSeconds: Number(f.work),
        restSeconds: Number(f.rest),
        elapsedSeconds: nullable(f.elapsed),
        rpe: nullable(f.rpe),
        tolerance: f.tolerance,
        notes: f.notes,
        completed: f.completed === 'true',
        updatedAt: now(),
      });
      if (!result.success) throw new Error(result.error.issues[0].message);
      await db.rope.put(result.data);
      await reset();
      notify('Jump-rope session saved.');
      onSaved();
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  if (!loaded) return <p>Restoring rope draft…</p>;
  return (
    <form className="form-stack" onSubmit={(e) => void submit(e)}>
      <div className="info-line">
        Reference · {stage.label}: {stage.rounds} × {stage.work}s, about 60s rest. Enter completed
        rounds below.
      </div>
      <p className="muted small">
        Small two-foot jumps and relaxed rhythm. Stages never advance automatically.{' '}
        {recent?.tolerance === 'poor'
          ? 'Recent tolerance was poor. Repeat, reduce or pause rather than advancing.'
          : 'Only consider the next stage when lower-leg tolerance and recovery are good.'}
      </p>
      <div className="form-grid">
        <Field label="Date">
          <input type="date" value={f.date} required onChange={(e) => c('date', e.target.value)} />
        </Field>
        <Input
          label="Rounds completed"
          value={f.rounds}
          onChange={(v) => c('rounds', v)}
          min={1}
          max={1000}
          step="1"
          required
        />
        <Input
          label="Work per round (seconds)"
          value={f.work}
          onChange={(v) => c('work', v)}
          min={1}
          max={3600}
          required
        />
        <Input
          label="Rest between rounds (seconds)"
          value={f.rest}
          onChange={(v) => c('rest', v)}
          max={3600}
          required
        />
        <Input
          label="Total elapsed time (seconds)"
          value={f.elapsed}
          onChange={(v) => c('elapsed', v)}
        />
        <Input
          label="Rope RPE (1–10)"
          value={f.rpe}
          onChange={(v) => c('rpe', v)}
          min={1}
          max={10}
        />
      </div>
      <div className="info-line">
        Active rope time: {rounded((Number(f.rounds) * Number(f.work)) / 60, 2)} min · Rest excluded
      </div>
      <Field label="Calf, shin, ankle & Achilles tolerance">
        <select value={f.tolerance} onChange={(e) => c('tolerance', e.target.value)}>
          <option value="unknown">Not assessed</option>
          <option value="good">Good · comfortable and recovered</option>
          <option value="poor">Poor · discomfort or insufficient recovery</option>
        </select>
      </Field>
      <Field label="Rope notes">
        <textarea value={f.notes} onChange={(e) => c('notes', e.target.value)} maxLength={10000} />
      </Field>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={f.completed === 'true'}
          onChange={(e) => c('completed', String(e.target.checked))}
        />
        Rope session completed
      </label>
      <button className="primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save jump rope'}
      </button>
    </form>
  );
}
