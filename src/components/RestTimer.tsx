import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { db } from '../storage/db';
import { useData } from './ui';
export async function startRest(duration: number) {
  await db.timers.put({
    id: 'rest',
    duration,
    remaining: duration,
    endAt: Date.now() + duration * 1000,
  });
}
export default function RestTimer() {
  const { report } = useData();
  const stored = useLiveQuery(() => db.timers.get('rest'), []);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setClock(Date.now()), 250);
    const wake = () => setClock(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(i);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);
  const t = stored ?? { id: 'rest' as const, duration: 120, remaining: 120, endAt: null };
  const remaining =
    t.endAt === null ? t.remaining : Math.max(0, Math.ceil((t.endAt - clock) / 1000));
  const put = (v: typeof t) => void db.timers.put(v).catch(report);
  return (
    <div className="rest-timer">
      <Timer size={18} />
      <div>
        <small>REST TIMER</small>
        <strong role="timer" aria-label="Rest remaining">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </strong>
      </div>
      <select
        aria-label="Rest duration"
        value={t.duration}
        onChange={(e) =>
          put({ ...t, duration: +e.target.value, remaining: +e.target.value, endAt: null })
        }
      >
        {[
          30,
          45,
          60,
          75,
          90,
          120,
          150,
          180,
          240,
          300,
          ...(![30, 45, 60, 75, 90, 120, 150, 180, 240, 300].includes(t.duration)
            ? [t.duration]
            : []),
        ]
          .sort((a, b) => a - b)
          .map((n) => (
            <option key={n} value={n}>
              {n}s
            </option>
          ))}
      </select>
      <button
        className="icon-button"
        aria-label={t.endAt && remaining > 0 ? 'Pause rest' : 'Start rest'}
        onClick={() => {
          if (t.endAt && remaining > 0) put({ ...t, remaining, endAt: null });
          else void startRest(remaining || t.duration).catch(report);
        }}
      >
        {t.endAt && remaining > 0 ? <Pause size={19} /> : <Play size={19} />}
      </button>
      <button
        className="icon-button"
        aria-label="Reset rest"
        onClick={() => put({ ...t, endAt: null, remaining: t.duration })}
      >
        <RotateCcw size={18} />
      </button>
      {remaining === 0 && <span className="accent small">Rest complete</span>}
    </div>
  );
}
