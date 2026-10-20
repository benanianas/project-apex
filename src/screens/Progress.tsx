import { lazy, Suspense, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import {
  cardioDistance,
  cardioPace,
  consistency,
  daysAgo,
  exerciseHistory,
  fromKg,
  fromKm,
  fromKmh,
  inRange,
  muscleSets,
  performanceVolume,
  ropeActive,
  rounded,
  sessionVolume,
  weekNumber,
  weekStart,
  weeklyStats,
} from '../domain/calculations';
import { dateKey, type Cardio, type Rope, type Session } from '../domain/model';
import { db, removeSession } from '../storage/db';
import { CardioForm, RopeForm } from '../components/ActivityForms';
import { Empty, Field, go, Modal, PageTitle, Section, Stat, useData } from '../components/ui';
const Chart = lazy(() => import('../components/Chart'));
export default function Progress() {
  const { sessions, cardio, rope, program, settings, exercises, report, notify } = useData();
  const [tab, setTab] = useState('Overview');
  const [range, setRange] = useState(12);
  const [modal, setModal] = useState<'cardio' | 'rope' | null>(null);
  const [editCardio, setEditCardio] = useState<Cardio>();
  const [editRope, setEditRope] = useState<Rope>();
  const [deleteRecord, setDeleteRecord] = useState<{
    kind: 'sessions' | 'cardio' | 'rope';
    id: string;
    label: string;
  } | null>(null);
  const [activity, setActivity] = useState('Treadmill running');
  const [similar, setSimilar] = useState(false);
  const [cardioMetric, setCardioMetric] = useState('minutes');
  const [ropeMetric, setRopeMetric] = useState('active');
  const [strengthMetric, setStrengthMetric] = useState('sets');
  const [exerciseId, setExerciseId] = useState('pull-up');
  const filteredS = sessions.filter((s) => inRange(s.date, range));
  const ss = filteredS.filter((s) => s.status === 'completed');
  const cc = cardio.filter((c) => c.completed && inRange(c.date, range));
  const rr = rope.filter((r) => r.completed && inRange(r.date, range));
  const weekly = weeklyStats(ss, cc, rr, settings.weekStart);
  const current = consistency(sessions, cardio, program, dateKey(), settings.weekStart);
  const muscle = muscleSets(ss.filter((s) => s.date >= current.start && s.date < current.end));
  const activityList = [
    ...new Set([
      'Treadmill running',
      'Outdoor running',
      'Incline walking',
      'Cycling',
      'Elliptical',
      ...cardio.map((c) => c.activity),
    ]),
  ];
  let comparable = cc
    .filter((c) => c.activity === activity)
    .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
  const latest = comparable.at(-1);
  if (similar && latest)
    comparable = comparable.filter(
      (c) =>
        c.rpe !== null &&
        latest.rpe !== null &&
        Math.abs(c.rpe - latest.rpe) <= 1 &&
        Math.abs(c.minutes - latest.minutes) <= 5,
    );
  const cardioPoints = comparable.flatMap((c) => {
    const value =
      cardioMetric === 'speed'
        ? c.speedKmh === null
          ? null
          : fromKmh(c.speedKmh, settings.speedUnit)
        : cardioMetric === 'distance'
          ? cardioDistance(c.speedKmh, c.minutes, c.distanceKm) === null
            ? null
            : fromKm(cardioDistance(c.speedKmh, c.minutes, c.distanceKm)!, settings.distanceUnit)
          : cardioMetric === 'pace'
            ? cardioPace(c) === null
              ? null
              : cardioPace(c)! * (settings.distanceUnit === 'mi' ? 1.609344 : 1)
            : cardioMetric === 'rpe'
              ? c.rpe
              : c.minutes;
    return value === null ? [] : [{ date: c.date, value }];
  });
  const cardioUnit =
    cardioMetric === 'speed'
      ? settings.speedUnit
      : cardioMetric === 'distance'
        ? settings.distanceUnit
        : cardioMetric === 'pace'
          ? `min/${settings.distanceUnit}`
          : cardioMetric === 'rpe'
            ? 'RPE'
            : 'min';
  const bests = exercises
    .flatMap((e) => {
      const history = exerciseHistory(e.id, sessions);
      const last = history.at(-1);
      if (!last || !inRange(last.session.date, range)) return [];
      const volume = performanceVolume(last.performance);
      if (volume === null || volume <= 0) return [];
      const previous = history.slice(0, -1).map((x) => performanceVolume(x.performance) ?? 0);
      return previous.length && volume > Math.max(...previous)
        ? [{ name: e.name, date: last.session.date, value: volume, id: e.id }]
        : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  async function remove() {
    if (!deleteRecord) return;
    try {
      if (deleteRecord.kind === 'sessions') await removeSession(deleteRecord.id);
      else await db[deleteRecord.kind].delete(deleteRecord.id);
      notify('Record deleted.');
      setDeleteRecord(null);
    } catch (e) {
      report(e);
    }
  }
  const chart = (data: { date: string; value: number }[], label: string, unit?: string) => (
    <Suspense fallback={<p>Loading chart…</p>}>
      <Chart data={data} label={label} unit={unit} />
    </Suspense>
  );
  const recordSession = (s: Session) => (
    <div className="history-row" key={s.id}>
      <button onClick={() => go(`workout/${s.id}`)}>
        <strong>{s.title}</strong>
        <small>
          {s.date} · {s.kind} · {s.status}
          {s.kind === 'strength'
            ? ` · ${rounded(fromKg(sessionVolume(s), settings.weightUnit))} ${settings.weightUnit}·reps`
            : ''}
        </small>
      </button>
      <button
        className="icon-button danger"
        aria-label={`Delete ${s.title}`}
        onClick={() => setDeleteRecord({ kind: 'sessions', id: s.id, label: s.title })}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR TRAINING"
        title="Progress"
        subtitle="Every session adds up."
        action={
          <select
            aria-label="Progress date range"
            value={range}
            onChange={(e) => setRange(+e.target.value)}
          >
            <option value={4}>Last 4 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={0}>All time</option>
          </select>
        }
      />
      <div className="tabs">
        {['Overview', 'Strength', 'Cardio', 'Jump rope', 'History'].map((t) => (
          <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' && (
        <>
          <div className="stat-grid overview-stats">
            <Stat
              label="Strength this week"
              value={current.lifting}
              unit={`/ ${current.strengthTarget}`}
            />
            <Stat
              label="Cardio this week"
              value={current.cardio}
              unit={`/ ${current.cardioTarget}`}
            />
            <Stat label="Working sets" value={current.sets} />
            <Stat label="Aerobic minutes" value={rounded(current.minutes)} unit="min" />
          </div>
          <div className="two-grid">
            <Section title="Consistency">
              <div className="card">
                <div className="week-progress">
                  <strong>
                    {current.percent}
                    <small>%</small>
                  </strong>
                  <p className="muted">
                    of weekly session targets
                    <br />
                    {current.start} → {daysAgo(1, current.end)}
                  </p>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${current.percent}%` }} />
                </div>
                <p>
                  {current.days} active dates · {current.recovery} recovery sessions
                </p>
                <p className="muted small">
                  Rest days carry no penalty. This compares completed strength and cardio sessions
                  with your program targets, regardless of training order.
                </p>
              </div>
            </Section>
            <Section title="Weekly aerobic minutes">
              <div className="card">
                {chart(
                  weekly.map((w) => ({ date: w.date, value: w.minutes })),
                  'Aerobic minutes',
                  'min',
                )}
              </div>
            </Section>
          </div>
          <Section
            title="Training calendar"
            aside={<span className="small muted">Past 28 days</span>}
          >
            <div className="card">
              <div className="calendar-grid">
                {Array.from({ length: 28 }, (_, i) => daysAgo(27 - i)).map((d) => {
                  const count =
                    sessions.filter((s) => s.status === 'completed' && s.date === d).length +
                    cardio.filter((c) => c.completed && c.date === d && !c.sessionId).length +
                    rope.filter((r) => r.completed && r.date === d && !r.sessionId).length;
                  return (
                    <div
                      key={d}
                      className={count ? 'trained' : ''}
                      title={`${d}: ${count} completed session${count === 1 ? '' : 's'}`}
                    >
                      <span>
                        {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: 'narrow',
                        })}
                      </span>
                      <strong>{Number(d.slice(-2))}</strong>
                      <span>{count ? '●' : '·'}</span>
                    </div>
                  );
                })}
              </div>
              <p className="small muted">
                Highlighted dates contain saved activity. Unmarked days are not classified as missed
                workouts.
              </p>
            </div>
          </Section>
          <Section title={`${program.block} · block review`}>
            <div className="card">
              <p>
                Week {weekNumber(program)} of {program.weeks} · Started {program.startDate}
              </p>
              <div className="stat-grid">
                <Stat
                  label="Lifting sessions"
                  value={
                    sessions.filter(
                      (s) =>
                        s.status === 'completed' &&
                        s.kind === 'strength' &&
                        s.programId === program.id &&
                        s.date >= program.startDate,
                    ).length
                  }
                />
                <Stat
                  label="Longest aerobic session"
                  value={Math.max(
                    0,
                    ...cardio
                      .filter((c) => c.completed && c.date >= program.startDate)
                      .map((c) => c.minutes),
                  )}
                  unit="min"
                />
                <Stat
                  label="Longest rope active time"
                  value={rounded(
                    Math.max(
                      0,
                      ...rope
                        .filter((r) => r.completed && r.date >= program.startDate)
                        .map(ropeActive),
                    ) / 60,
                  )}
                  unit="min"
                />
              </div>
              <p className="muted">
                Review individual exercise trends for strength maintenance, weekly sets for
                workload, and comparable cardio efforts for endurance. Your block start date is
                adjustable in Program.
              </p>
            </div>
          </Section>
        </>
      )}
      {tab === 'Strength' && (
        <>
          <Section
            title="Weekly resistance training"
            aside={
              <select
                aria-label="Strength metric"
                value={strengthMetric}
                onChange={(e) => setStrengthMetric(e.target.value)}
              >
                <option value="sets">Working sets</option>
                <option value="volume">External volume</option>
              </select>
            }
          >
            <div className="card">
              {chart(
                weekly.map((w) => ({
                  date: w.date,
                  value: strengthMetric === 'sets' ? w.sets : fromKg(w.volume, settings.weightUnit),
                })),
                strengthMetric === 'sets' ? 'Working sets' : 'External volume',
                strengthMetric === 'sets' ? 'sets' : `${settings.weightUnit}·reps`,
              )}
              <p className="muted small">
                Sets count all completed working sets. Volume includes compatible resistance
                movements only. Totals can change with exercise selection; compare the same program
                and individual exercise variants before inferring strength gains.
              </p>
            </div>
          </Section>
          <div className="two-grid">
            <Section title="Primary-muscle sets · this week">
              <div className="card">
                {muscle.length ? (
                  muscle.map(([name, count]) => (
                    <div className="muscle-row" key={name}>
                      <span>{name}</span>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${(count / Math.max(...muscle.map((m) => m[1]))) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  ))
                ) : (
                  <Empty title="Room to build">Completed working sets will appear here.</Empty>
                )}
                <p className="small muted">
                  Each set is assigned once to its primary muscle. Secondary involvement is not
                  added. Counts approximate hard sets; effort and technique still matter.
                </p>
              </div>
            </Section>
            <Section title="Recent volume records">
              <div className="card">
                {bests.length ? (
                  bests.map((b) => (
                    <button
                      className="history-row"
                      key={b.id}
                      onClick={() => go(`exercise/${b.id}`)}
                    >
                      <span>
                        {b.name}
                        <small>{b.date}</small>
                      </span>
                      <strong>
                        {rounded(fromKg(b.value, settings.weightUnit))} {settings.weightUnit}·reps
                      </strong>
                    </button>
                  ))
                ) : (
                  <Empty title="Build your baseline">
                    A new best is shown after beating a previous comparable exercise session.
                  </Empty>
                )}
              </div>
            </Section>
          </div>
          <Section title="Explore an exercise">
            <div className="card">
              <Field label="Exercise">
                <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                  {exercises
                    .filter((e) => !e.archived)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button onClick={() => go(`exercise/${exerciseId}`)}>
                View progression, records & guidance ↗
              </button>
            </div>
          </Section>
        </>
      )}
      {tab === 'Cardio' && (
        <>
          <div className="section-heading section">
            <h2>Aerobic development</h2>
            <button
              onClick={() => {
                setEditCardio(undefined);
                setModal('cardio');
              }}
            >
              <Plus size={16} />
              Log cardio
            </button>
          </div>
          <div className="card">
            <div className="filter-row">
              <select
                aria-label="Cardio modality"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              >
                {activityList.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              <select
                aria-label="Cardio metric"
                value={cardioMetric}
                onChange={(e) => setCardioMetric(e.target.value)}
              >
                <option value="minutes">Duration</option>
                <option value="speed">Average speed</option>
                <option value="distance">Distance</option>
                <option value="pace">Pace</option>
                <option value="rpe">RPE</option>
              </select>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={similar}
                onChange={(e) => setSimilar(e.target.checked)}
              />
              Compare with latest effort: within 5 minutes and 1 RPE
            </label>
            {chart(cardioPoints, cardioMetric, cardioUnit)}
            <p className="muted small">
              {similar ? 'Missing RPE is excluded from effort comparisons. ' : ''}Only{' '}
              {activity.toLowerCase()} is shown. Longer at similar effort, or faster at comparable
              duration and effort, can be useful progress. More intensity is not always better.
            </p>
            <div className="stat-grid">
              <Stat
                label="Longest continuous session"
                value={Math.max(0, ...comparable.map((c) => c.minutes))}
                unit="min"
              />
              <Stat
                label="Fastest comparable average"
                value={
                  comparable.some((c) => c.speedKmh !== null)
                    ? rounded(
                        fromKmh(
                          Math.max(...comparable.map((c) => c.speedKmh ?? 0)),
                          settings.speedUnit,
                        ),
                        2,
                      )
                    : '—'
                }
                unit={settings.speedUnit}
              />
              <Stat
                label="Distance recorded"
                value={rounded(
                  fromKm(
                    comparable.reduce(
                      (n, c) => n + (cardioDistance(c.speedKmh, c.minutes, c.distanceKm) ?? 0),
                      0,
                    ),
                    settings.distanceUnit,
                  ),
                  2,
                )}
                unit={settings.distanceUnit}
              />
            </div>
          </div>
          <Section title="Duration by modality">
            <div className="card">
              {activityList
                .filter((a) => cc.some((c) => c.activity === a))
                .map((a) => (
                  <div className="history-row" key={a}>
                    <span>{a}</span>
                    <strong>
                      {rounded(
                        cc.filter((c) => c.activity === a).reduce((n, c) => n + c.minutes, 0),
                      )}{' '}
                      min
                    </strong>
                  </div>
                ))}
            </div>
          </Section>
          <Section title="Weekly aerobic minutes">
            <div className="card">
              {chart(
                weekly.map((w) => ({ date: w.date, value: w.minutes })),
                'Aerobic minutes',
                'min',
              )}
            </div>
          </Section>
        </>
      )}
      {tab === 'Jump rope' && (
        <>
          <div className="section-heading section">
            <h2>Rhythm, then endurance.</h2>
            <button
              onClick={() => {
                setEditRope(undefined);
                setModal('rope');
              }}
            >
              <Plus size={16} />
              Log jump rope
            </button>
          </div>
          <div className="card">
            <div className="filter-row">
              <select
                aria-label="Rope chart metric"
                value={ropeMetric}
                onChange={(e) => setRopeMetric(e.target.value)}
              >
                <option value="active">Active minutes per session</option>
                <option value="rounds">Completed rounds</option>
                <option value="work">Work interval seconds</option>
                <option value="weekly">Weekly active minutes</option>
                <option value="sessions">Weekly sessions</option>
              </select>
            </div>
            {chart(
              ropeMetric === 'weekly'
                ? weekly.map((w) => ({ date: w.date, value: w.rope }))
                : ropeMetric === 'sessions'
                  ? [...new Set(rr.map((r) => weekStart(r.date, settings.weekStart)))]
                      .sort()
                      .map((date) => ({
                        date,
                        value: rr.filter((r) => weekStart(r.date, settings.weekStart) === date)
                          .length,
                      }))
                  : [...rr]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((r) => ({
                        date: r.date,
                        value:
                          ropeMetric === 'active'
                            ? ropeActive(r) / 60
                            : ropeMetric === 'rounds'
                              ? r.rounds
                              : r.workSeconds,
                      })),
              ropeMetric === 'active' ? 'Active rope time' : ropeMetric,
              ropeMetric === 'active' || ropeMetric === 'weekly'
                ? 'min'
                : ropeMetric === 'work'
                  ? 'sec'
                  : '',
            )}
            <div className="stat-grid">
              <Stat
                label="Longest active time"
                value={rounded(Math.max(0, ...rr.map(ropeActive)) / 60)}
                unit="min"
              />
              <Stat
                label="Longest work interval"
                value={Math.max(0, ...rr.map((r) => r.workSeconds))}
                unit="sec"
              />
              <Stat label="Sessions in range" value={rr.length} />
            </div>
            <p className="muted">
              Long-term reference: 3 × 3-minute rounds with 1-minute rests. Equal total time in
              short intervals is not the same achievement. Progress only with good tolerance and
              recovery.
            </p>
          </div>
        </>
      )}
      {tab === 'History' && (
        <>
          <Section title="Workouts & recovery" aside={<CalendarDays size={18} />}>
            <div className="card">
              {filteredS.length ? (
                [...filteredS]
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt),
                  )
                  .map(recordSession)
              ) : (
                <Empty title="Your training story starts here">
                  Start a workout from Today. Drafts and completed sessions appear here.
                </Empty>
              )}
            </div>
          </Section>
          <Section
            title="Cardio records"
            aside={
              <button
                onClick={() => {
                  setEditCardio(undefined);
                  setModal('cardio');
                }}
              >
                Add cardio
              </button>
            }
          >
            <div className="card">
              {cardio
                .filter((c) => inRange(c.date, range))
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((c) => (
                  <div className="history-row" key={c.id}>
                    <button
                      onClick={() => {
                        setEditCardio(c);
                        setModal('cardio');
                      }}
                    >
                      <strong>{c.activity}</strong>
                      <small>
                        {c.date} · {c.minutes} min · {c.completed ? 'Completed' : 'Incomplete'}
                        {c.rpe !== null ? ` · RPE ${c.rpe}` : ''}
                      </small>
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete cardio ${c.date}`}
                      onClick={() =>
                        setDeleteRecord({
                          kind: 'cardio',
                          id: c.id,
                          label: `${c.activity} on ${c.date}`,
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </Section>
          <Section
            title="Jump-rope records"
            aside={
              <button
                onClick={() => {
                  setEditRope(undefined);
                  setModal('rope');
                }}
              >
                Add rope
              </button>
            }
          >
            <div className="card">
              {rope
                .filter((r) => inRange(r.date, range))
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => (
                  <div className="history-row" key={r.id}>
                    <button
                      onClick={() => {
                        setEditRope(r);
                        setModal('rope');
                      }}
                    >
                      <strong>
                        {r.rounds} × {r.workSeconds}s
                      </strong>
                      <small>
                        {r.date} · {rounded(ropeActive(r) / 60)} active min ·{' '}
                        {r.completed ? 'Completed' : 'Incomplete'} · Tolerance {r.tolerance}
                      </small>
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete rope ${r.date}`}
                      onClick={() =>
                        setDeleteRecord({ kind: 'rope', id: r.id, label: `Jump rope on ${r.date}` })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </Section>
        </>
      )}
      {modal === 'cardio' && (
        <Modal title={editCardio ? 'Edit cardio' : 'Log cardio'} onClose={() => setModal(null)}>
          <CardioForm
            key={editCardio?.id ?? 'new'}
            existing={editCardio}
            onSaved={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === 'rope' && (
        <Modal title={editRope ? 'Edit jump rope' : 'Log jump rope'} onClose={() => setModal(null)}>
          <RopeForm
            key={editRope?.id ?? 'new'}
            existing={editRope}
            onSaved={() => setModal(null)}
          />
        </Modal>
      )}
      {deleteRecord && (
        <Modal title="Delete this record?" onClose={() => setDeleteRecord(null)}>
          <p>{deleteRecord.label}</p>
          <p className="muted">
            This removes the saved record
            {deleteRecord.kind === 'sessions' ? ' and any linked cardio and rope activities' : ''}.
            Export a backup first if you want to keep a copy.
          </p>
          <button className="danger" onClick={() => void remove()}>
            Delete record permanently
          </button>
        </Modal>
      )}
    </>
  );
}
