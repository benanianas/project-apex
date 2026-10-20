import { Check, ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import { newSet, uid, type Performance, type SetRecord } from '../domain/model';
import { fromKg, performanceVolume, rounded, toKg, workingSets } from '../domain/calculations';
import { Field, NumberInput, useData } from './ui';
export default function SetEditor({
  performance: p,
  editSet,
  complete,
  removeSet,
  updatePerformance,
}: {
  performance: Performance;
  editSet: (id: string, patch: Partial<SetRecord>) => void;
  complete: (p: Performance, s: SetRecord) => void;
  removeSet: (id: string) => void;
  updatePerformance: (fn: (p: Performance) => Performance) => void;
}) {
  const { settings } = useData();
  const load = ['resistance', 'assisted', 'weighted-bodyweight', 'carry'].includes(p.exercise.type);
  const reps = ['resistance', 'bodyweight', 'assisted', 'weighted-bodyweight'].includes(
    p.exercise.type,
  );
  const timed = ['timed', 'carry'].includes(p.exercise.type);
  const distance = ['distance', 'carry'].includes(p.exercise.type);
  return (
    <>
      <div className={`sets-table ${load ? '' : 'no-load'}`}>
        <div className="set-header">
          <span>SET</span>
          {load && (
            <span>
              {p.exercise.type === 'assisted' ? 'ASSIST' : settings.weightUnit.toUpperCase()}
            </span>
          )}
          <span>{reps ? 'REPS' : timed ? 'SEC' : 'METERS'}</span>
          <span>RIR</span>
          <span>DONE</span>
        </div>
        {p.sets.map((s, i) => (
          <div className={`set-entry ${s.done ? 'set-done' : ''}`} key={s.id}>
            <div className="set-row">
              <button
                className={`set-kind ${s.warmup ? 'warm' : ''}`}
                aria-label={`Set ${i + 1}: ${s.warmup ? 'warm-up' : 'working'}. Toggle type`}
                onClick={() => editSet(s.id, { warmup: !s.warmup })}
              >
                {s.warmup ? 'W' : i + 1}
              </button>
              {load && (
                <NumberInput
                  label={`Set ${i + 1} ${p.exercise.type === 'assisted' ? 'assistance' : 'weight'}`}
                  value={
                    s.loadKg === null ? null : rounded(fromKg(s.loadKg, settings.weightUnit), 3)
                  }
                  onChange={(v) =>
                    editSet(s.id, {
                      loadKg: v === null ? null : toKg(v, settings.weightUnit),
                    })
                  }
                />
              )}
              <NumberInput
                label={`Set ${i + 1} ${reps ? 'repetitions' : timed ? 'seconds' : 'meters'}`}
                value={reps ? s.reps : timed ? s.seconds : s.meters}
                step={reps ? '1' : 'any'}
                onChange={(v) =>
                  editSet(s.id, reps ? { reps: v } : timed ? { seconds: v } : { meters: v })
                }
              />
              <NumberInput
                label={`Set ${i + 1} RIR`}
                max={10}
                value={s.rir}
                onChange={(v) => editSet(s.id, { rir: v })}
              />
              <button
                className={`complete-set ${s.done ? 'checked' : ''}`}
                aria-label={`${s.done ? 'Uncomplete' : 'Complete'} set ${i + 1}`}
                aria-pressed={s.done}
                onClick={() => complete(p, s)}
              >
                <Check size={20} />
              </button>
            </div>
            <details className="set-details">
              <summary>
                Set options <ChevronDown size={12} />
              </summary>
              <div className="form-grid">
                <Field label="RPE (optional)">
                  <NumberInput
                    label={`Set ${i + 1} RPE`}
                    min={1}
                    max={10}
                    value={s.rpe}
                    onChange={(v) => editSet(s.id, { rpe: v })}
                  />
                </Field>
                {distance && timed && (
                  <Field label="Carry distance (meters)">
                    <NumberInput
                      label={`Set ${i + 1} carry distance`}
                      value={s.meters}
                      onChange={(v) => editSet(s.id, { meters: v })}
                    />
                  </Field>
                )}
                <Field label="Set notes">
                  <input
                    value={s.notes}
                    maxLength={10000}
                    onChange={(e) => editSet(s.id, { notes: e.target.value })}
                  />
                </Field>
              </div>
              <button className="danger text-button" onClick={() => removeSet(s.id)}>
                <Trash2 size={14} />
                Remove set
              </button>
            </details>
          </div>
        ))}
      </div>
      <div className="log-actions">
        <button
          className="text-button"
          onClick={() => updatePerformance((p) => ({ ...p, sets: [...p.sets, newSet()] }))}
        >
          <Plus size={16} />
          Add set
        </button>
        <button
          className="text-button"
          onClick={() =>
            updatePerformance((p) => ({
              ...p,
              sets: [...p.sets, { ...(p.sets.at(-1) ?? newSet()), id: uid(), done: false }],
            }))
          }
        >
          <Copy size={15} />
          Duplicate last
        </button>
        <span className="muted small">
          {performanceVolume(p) !== null
            ? `${rounded(fromKg(performanceVolume(p)!, settings.weightUnit))} ${settings.weightUnit}·reps`
            : `${workingSets(p).length} working sets`}
        </span>
      </div>
    </>
  );
}
