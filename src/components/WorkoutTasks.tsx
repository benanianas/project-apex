import { useState } from 'react';
import { Check } from 'lucide-react';
import { now, type Session, type TrainingTask } from '../domain/model';
import { priorityOrder, taskComplete, taskLabel } from '../domain/training';
import { Section, useData } from './ui';
import SkipItemDialog from './SkipItemDialog';
export default function WorkoutTasks({
  session,
  onChange,
  onCardio,
  onRope,
}: {
  session: Session;
  onChange: (patch: Partial<Session>) => void;
  onCardio: () => void;
  onRope: () => void;
}) {
  const { cardio, rope } = useData();
  const [skipping, setSkipping] = useState<TrainingTask>();
  const update = (id: string, state: NonNullable<Session['taskStates']>[string]) =>
    onChange({ taskStates: { ...session.taskStates, [id]: state } });
  return (
    <Section title="Today's priorities">
      <div className="training-tasks">
        {priorityOrder(session.daySnapshot?.tasks ?? []).map((task) => {
          const done = taskComplete(task, session, cardio, rope);
          const skipped = session.taskStates?.[task.id]?.skipped;
          return (
            <div className="card training-task" key={task.id}>
              <span className={`priority-badge ${task.priority}`}>
                {task.priority === 'mandatory' ? 'Mandatory' : 'Optional'}
              </span>
              <h3>{taskLabel(task)}</h3>
              {skipped ? (
                <p className="small muted">Skipped: {skipped.reason}</p>
              ) : done ? (
                <p className="accent small">Complete</p>
              ) : null}
              <div className="button-row">
                {task.kind === 'cardio' || task.kind === 'rope' ? (
                  <button
                    onClick={() => {
                      if (skipped) update(task.id, { done: false });
                      if (task.kind === 'cardio') onCardio();
                      else onRope();
                    }}
                  >
                    {task.kind === 'cardio' ? 'Log cardio' : 'Log jump rope'}
                  </button>
                ) : (
                  <button aria-pressed={done} onClick={() => update(task.id, { done: !done })}>
                    {done ? 'Uncheck' : 'Mark complete'}
                    <Check size={16} />
                  </button>
                )}
                {skipped ? (
                  <button className="text-button" onClick={() => update(task.id, { done: false })}>
                    Undo skip
                  </button>
                ) : (
                  <button className="text-button" onClick={() => setSkipping(task)}>
                    Skip item
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {skipping && (
        <SkipItemDialog
          name={skipping.label}
          onClose={() => setSkipping(undefined)}
          onSkip={(reason) => {
            update(skipping.id, { done: false, skipped: { reason, at: now() } });
            setSkipping(undefined);
          }}
        />
      )}
    </Section>
  );
}
