import type { Performance } from '../domain/model';
import { fromKg, rounded, workingSets } from '../domain/calculations';
import { currentSuggestion, previousPerformances } from '../domain/history';
import { useData } from './ui';
export default function PreviousPerformance({
  performance,
  sessionId,
  programId,
}: {
  performance: Performance;
  sessionId: string;
  programId?: string;
}) {
  const { sessions, settings } = useData();
  const previous = previousPerformances(performance, sessions, sessionId, programId).at(-1);
  const advice = currentSuggestion(
    performance,
    sessions,
    sessionId,
    settings.loadIncrementKg,
    programId,
  );
  if (!previous) return <p className="previous-empty">No previous performance recorded.</p>;
  const { exercise } = previous.performance;
  const load = ['resistance', 'assisted', 'weighted-bodyweight', 'carry'].includes(exercise.type);
  const timed = ['timed', 'carry'].includes(exercise.type);
  return (
    <div className="previous-performance">
      <p>
        <strong>Previous performance</strong>
        <time dateTime={previous.session.date}>
          {new Date(`${previous.session.date}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </time>
      </p>
      <table aria-label={`Previous ${exercise.name} sets`}>
        <thead>
          <tr>
            <th>Set</th>
            {load && (
              <th>
                {exercise.type === 'assisted'
                  ? 'Assistance'
                  : exercise.type === 'weighted-bodyweight'
                    ? 'Added load'
                    : 'Weight'}
              </th>
            )}
            <th>
              {timed
                ? 'Time / distance'
                : exercise.type === 'distance'
                  ? 'Distance'
                  : exercise.sides === 2
                    ? 'Reps / side'
                    : 'Reps'}
            </th>
            <th>RIR</th>
          </tr>
        </thead>
        <tbody>
          {workingSets(previous.performance).map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              {load && (
                <td>
                  {s.loadKg === null
                    ? '—'
                    : `${rounded(fromKg(s.loadKg, settings.weightUnit), 2)} ${settings.weightUnit}${exercise.loadMode === 'per-hand' ? '/hand' : ' total'}`}
                </td>
              )}
              <td>
                {timed
                  ? [
                      s.seconds === null ? null : `${s.seconds}s`,
                      s.meters === null ? null : `${s.meters}m`,
                    ]
                      .filter(Boolean)
                      .join(' / ') || '—'
                  : exercise.type === 'distance'
                    ? s.meters === null
                      ? '—'
                      : `${s.meters}m`
                    : (s.reps ?? '—')}
              </td>
              <td>{s.rir ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {previous.performance.equipmentLabel ? (
        <small>{previous.performance.equipmentLabel}</small>
      ) : (
        /machine|cable/i.test(exercise.equipment) && (
          <small>
            Machine not specified. Compare only on the same equipment; add a machine label below to
            keep references separate.
          </small>
        )
      )}
      {advice && (
        <p className="previous-advice">
          {advice.title}.{' '}
          {advice.nextKg !== undefined
            ? `Optional next load: ${rounded(fromKg(advice.nextKg, settings.weightUnit), 2)} ${settings.weightUnit}${exercise.loadMode === 'per-hand' ? '/hand' : ' total'}. `
            : ''}
          {advice.detail}
        </p>
      )}
    </div>
  );
}
