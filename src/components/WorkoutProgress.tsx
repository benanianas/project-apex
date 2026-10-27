import type { Session } from '../domain/model';
import { sessionProgress } from '../domain/training';
import { useData } from './ui';
export default function WorkoutProgress({ session }: { session: Session }) {
  const { cardio, rope } = useData();
  const p = sessionProgress(session, cardio, rope);
  return (
    <div className="workout-priority-summary" aria-label="Workout priorities">
      <div>
        <strong>
          {p.mandatoryDone}/{p.mandatory}
        </strong>
        <span>Mandatory complete</span>
      </div>
      <div>
        <strong>
          {p.optionalDone}/{p.optional}
        </strong>
        <span>Optional complete</span>
      </div>
      <div>
        <strong>~{p.remainingMinutes} min</strong>
        <span>Remaining incl. optional</span>
      </div>
      <p className={p.essential === 'complete' ? 'accent' : 'muted'}>
        {p.essential === 'none'
          ? 'No mandatory training today.'
          : p.essential === 'complete'
            ? 'Essential work complete. Optional work is your choice.'
            : `Essential work ${session.status === 'completed' ? 'partially completed' : 'in progress'}.${p.skipped ? ` ${p.skipped} item${p.skipped === 1 ? '' : 's'} skipped.` : ''}`}
      </p>
    </div>
  );
}
