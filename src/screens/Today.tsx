import { useState } from 'react';
import { ArrowRight, Check, Clock3, Dumbbell, Leaf, Moon, MoveUpRight, Zap } from 'lucide-react';
import { consistency, weekNumber } from '../domain/calculations';
import { dateKey } from '../domain/model';
import { createSession, db } from '../storage/db';
import { ropeStages } from '../data/program';
import { findGuide } from '../data/exercises';
import { effectiveDay, priorityOf, priorityOrder, taskLabel } from '../domain/training';
import WorkoutProgress from '../components/WorkoutProgress';
import ExerciseDiagram from '../components/ExerciseDiagram';
import { go, PageTitle, Section, useData } from '../components/ui';
export default function Today() {
  const { program, settings, exercises, sessions, cardio, report } = useData();
  const sourceDay = program.days.find((d) => d.id === settings.selectedDayId) ?? program.days[0];
  const day = effectiveDay(program, sourceDay);
  const index = program.days.indexOf(sourceDay);
  const [starting, setStarting] = useState(false);
  const assigned = program.days.filter((d) => d.weekday === new Date().getDay());
  const draft = sessions.find(
    (s) => s.dayId === day.id && s.programId === program.id && s.status === 'draft',
  );
  const completed = sessions.filter(
    (s) =>
      s.dayId === day.id &&
      s.programId === program.id &&
      s.status === 'completed' &&
      s.date === dateKey(),
  );
  const weekly = consistency(sessions, cardio, program, dateKey(), settings.weekStart);
  const mandatory =
    day.exercises.filter((p) => priorityOf(p) === 'mandatory').length +
    (day.tasks?.filter((t) => t.priority === 'mandatory').length ?? 0);
  const optional =
    day.exercises.filter((p) => priorityOf(p) === 'optional').length +
    (day.tasks?.filter((t) => t.priority === 'optional').length ?? 0);
  const planned = day.exercises.reduce((n, p) => n + p.sets, 0);
  const stage = ropeStages[settings.ropeStage];
  const Icon =
    day.kind === 'strength'
      ? Dumbbell
      : day.kind === 'cardio'
        ? Zap
        : day.kind === 'recovery'
          ? Leaf
          : Moon;
  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const session = draft ?? (await createSession(program, sourceDay));
      go(`workout/${session.id}`);
    } catch (e) {
      report(e);
    } finally {
      setStarting(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title="Today"
      />
      {assigned.length > 0 && (
        <div className="assigned-days">
          <span>Assigned for today:</span>
          {assigned.map((d) => (
            <button
              key={d.id}
              className="text-button"
              onClick={() =>
                void db.settings.update('settings', { selectedDayId: d.id }).catch(report)
              }
            >
              {d.title} ↗
            </button>
          ))}
        </div>
      )}
      <div className="today-layout">
        <div>
          <div className="program-strip">
            <span className="status-dot" />
            <span>{program.name}</span>
            <span className="pill">
              Week {weekNumber(program)} of {program.weeks}
            </span>
          </div>
          <div className="day-selector" aria-label="Training day">
            {program.days.map((d, i) => (
              <button
                key={d.id}
                className={d.id === day.id ? 'selected' : ''}
                aria-pressed={d.id === day.id}
                aria-label={`Day ${i + 1}: ${d.title}`}
                onClick={() =>
                  void db.settings.update('settings', { selectedDayId: d.id }).catch(report)
                }
              >
                <span>DAY</span>
                <strong>{String(i + 1).padStart(2, '0')}</strong>
                <i className={`day-dot ${d.kind}`} />
              </button>
            ))}
          </div>
          <section className={`hero-card ${day.kind}`}>
            <div className="hero-top">
              <span className="eyebrow">
                DAY {String(index + 1).padStart(2, '0')} <span> / </span>{' '}
                {day.kind === 'strength' ? 'FULL BODY TRAINING' : day.kind.toUpperCase()}
              </span>
              <Icon size={22} />
            </div>
            <h2>{day.title}</h2>
            <p className="hero-focus">{day.focus}</p>
            <div className="hero-meta">
              <span>
                <Clock3 size={16} />
                {day.duration}
              </span>
              {planned > 0 && (
                <>
                  <span>{day.exercises.length} exercises</span>
                  <span>{planned} working sets</span>
                </>
              )}
            </div>
            <p className="day-priority-counts">
              {mandatory} mandatory · {optional} optional
            </p>
            {day.kind === 'rest' ? (
              <div>
                <p className="rest-copy">
                  Nothing to tick off today. Enjoy normal light movement and optional gentle
                  stretching. Rest supports your next session.
                </p>
                {day.tasks?.some((t) => t.priority === 'optional') && (
                  <button className="text-button" disabled={starting} onClick={() => void start()}>
                    {draft ? 'Resume optional mobility' : 'Log optional mobility'}
                  </button>
                )}
              </div>
            ) : (
              <button
                className="primary hero-action"
                disabled={starting}
                onClick={() => void start()}
              >
                {draft
                  ? 'Resume workout'
                  : day.kind === 'recovery'
                    ? 'Start mobility'
                    : 'Start workout'}
                <ArrowRight size={20} />
              </button>
            )}
            {completed.length > 0 && (
              <p className="accent small">
                <Check size={15} /> {completed.length} session{completed.length > 1 ? 's' : ''}{' '}
                completed today. You can record another.
              </p>
            )}
          </section>
          {(draft || completed.at(-1)) && (
            <WorkoutProgress session={(draft ?? completed.at(-1))!} />
          )}
          {program.readiness && (
            <p className="small muted readiness-note">
              {day.intervalPlan
                ? day.intervalActive
                  ? 'Controlled intervals enabled. Reduce to easy aerobic work in Program if recovery is limited.'
                  : 'Easy aerobic work is active. From week 3, enable controlled intervals in Program only if recovery permits.'
                : day.powerOption
                  ? 'No jumps required. Optional 3 × 3 squat jumps can be enabled in Program after two weeks with good recovery and joint tolerance.'
                  : 'General athletic preparation for coached boxing. No boxing technique drills.'}
            </p>
          )}
          {day.kind === 'strength' && (
            <Section
              title="The session"
              aside={<span className="muted small">{planned} working sets</span>}
            >
              <div className="exercise-list">
                {day.exercises.map((p, i) => {
                  const e = exercises.find((e) => e.id === p.exerciseId);
                  return (
                    e && (
                      <button
                        className="exercise-row"
                        key={p.id}
                        onClick={() => go(`exercise/${e.id}`)}
                      >
                        <span className="row-number">{String(i + 1).padStart(2, '0')}</span>
                        <ExerciseDiagram exercise={e} small />
                        <div>
                          <span className={`priority-badge ${priorityOf(p)}`}>
                            {priorityOf(p) === 'mandatory' ? 'Mandatory' : 'Optional'}
                          </span>
                          <h3>{e.name}</h3>
                          <p>
                            {e.primary}
                            <span> · </span>
                            {p.rest}s rest{e.sides === 2 ? ' · each side' : ''}
                          </p>
                        </div>
                        <span className="prescription">
                          {p.sets}
                          <span> × </span>
                          {p.unit === 'submax'
                            ? 'submax'
                            : `${p.min}${p.max !== p.min ? `–${p.max}` : ''}`}
                          {p.unit === 'seconds' ? 's' : ''}
                        </span>
                        <MoveUpRight size={15} />
                      </button>
                    )
                  );
                })}
              </div>
            </Section>
          )}
          {day.tasks && (
            <Section title="Today's priorities">
              <div className="card task-preview">
                {priorityOrder(day.tasks).map((task) => (
                  <div key={task.id}>
                    <span className={`priority-badge ${task.priority}`}>
                      {task.priority === 'mandatory' ? 'Mandatory' : 'Optional'}
                    </span>
                    <p>{taskLabel(task)}</p>
                  </div>
                ))}
              </div>
              {day.cardio && (
                <p className="small muted">
                  Log your actual duration, speed, incline, distance and effort. Treadmill speed
                  follows conversational effort; 6 mph is not required.
                </p>
              )}
            </Section>
          )}
          {day.cardio && !day.tasks && (
            <Section title="Your conditioning">
              <div className="two-grid">
                <div className="card">
                  <span className="eyebrow">AEROBIC BASE</span>
                  <h3 className="big-number">
                    {day.cardio.min}–{day.cardio.max}
                    <small> min</small>
                  </h3>
                  <p>
                    {day.cardio.activity} · RPE {day.cardio.rpe}
                  </p>
                  <p className="muted">
                    Conversational effort.{' '}
                    {day.cardio.speedMin
                      ? '5.5–6.0 mph is a starting reference, adjusted to your effort.'
                      : 'Finish feeling capable of continuing. Choose running, cycling, elliptical or incline walking.'}
                  </p>
                </div>
                <div className="card">
                  <span className="eyebrow">JUMP ROPE · {stage.label.toUpperCase()}</span>
                  <h3 className="big-number">
                    {stage.rounds} × {stage.work}
                    <small>s</small>
                  </h3>
                  <p>60 seconds rest between rounds</p>
                  <p className="muted">
                    Basic two-foot jumps. Low bounce, relaxed rhythm. Progress only with good
                    lower-leg tolerance.
                  </p>
                </div>
              </div>
            </Section>
          )}
          {day.warmup.length > 0 && (
            <details className="today-checklist section">
              <summary>
                Warm-up <span>{day.warmup.length} movements</span>
              </summary>
              <div className="card checklist-preview">
                {day.warmup.map((item) => (
                  <button
                    key={item}
                    className="guide-line"
                    onClick={() => {
                      const e = findGuide(item, exercises);
                      if (e) go(`exercise/${e.id}`);
                    }}
                  >
                    <span className="tiny-dot" />
                    {item}
                    <MoveUpRight size={14} />
                  </button>
                ))}
              </div>
            </details>
          )}
          {day.mobility.length > 0 && (
            <Section
              title={
                day.kind === 'recovery'
                  ? 'Mobility & optional stretching'
                  : 'Cool down & flexibility'
              }
            >
              <div className="card checklist-preview">
                {day.mobility.map((item) => (
                  <button
                    key={item}
                    className="guide-line"
                    onClick={() => {
                      const e = findGuide(item, exercises);
                      if (e) go(`exercise/${e.id}`);
                    }}
                  >
                    <span className="tiny-dot" />
                    {item}
                    <MoveUpRight size={14} />
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
        <aside className="today-aside">
          <button className="week-summary" onClick={() => go('progress')}>
            <svg viewBox="0 0 60 60" aria-hidden="true">
              <circle cx="30" cy="30" r="25" fill="none" stroke="var(--border)" strokeWidth="5" />
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="5"
                strokeDasharray={`${weekly.percent * 1.57} 157`}
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
              />
              <text x="30" y="34" textAnchor="middle" fill="currentColor" fontSize="13">
                {weekly.percent}%
              </text>
            </svg>
            <span>
              <strong>This training week</strong>
              <small>
                {weekly.lifting}/{weekly.strengthTarget} strength · {weekly.cardio}/
                {weekly.cardioTarget} cardio
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
          {weekNumber(program) > program.weeks && (
            <div className="card section">
              <h3>Time to reassess</h3>
              <p className="muted">Your {program.weeks}-week block has elapsed.</p>
              <button onClick={() => go('progress')}>Review block</button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
