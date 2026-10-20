import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Settings2,
  WifiOff,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { db, seed } from './storage/db';
import { DataContext, ErrorBoundary, errorMessage, go } from './components/ui';
import Today from './screens/Today';
import KeyboardViewport from './components/KeyboardViewport';
const Workout = lazy(() => import('./screens/Workout'));
const Exercises = lazy(() => import('./screens/Exercises'));
const Progress = lazy(() => import('./screens/Progress'));
const Program = lazy(() => import('./screens/Program'));
const Settings = lazy(() => import('./screens/Settings'));
const nav = [
  { id: 'today', label: 'Today', icon: Activity },
  { id: 'program', label: 'Program', icon: CalendarDays },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesCombined },
  { id: 'exercises', label: 'Exercises', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];
export default function App() {
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const [route, setRoute] = useState(location.hash.slice(1) || 'today');
  const [online, setOnline] = useState(navigator.onLine);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) =>
      setMessage(`Offline setup failed: ${errorMessage(e)}. Reconnect and reload to retry.`),
  });
  useEffect(() => {
    void seed()
      .then(() => {
        setReady(true);
        if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
      })
      .catch((e) => setFatal(errorMessage(e)));
    const hash = () => setRoute(location.hash.slice(1) || 'today');
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', hash);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
  }, []);
  const data = useLiveQuery(async () => {
    if (!ready) return;
    const [exercises, programs, sessions, cardio, rope, settings] = await Promise.all([
      db.exercises.toArray(),
      db.programs.toArray(),
      db.sessions.toArray(),
      db.cardio.toArray(),
      db.rope.toArray(),
      db.settings.get('settings'),
    ]);
    return settings ? { exercises, programs, sessions, cardio, rope, settings } : undefined;
  }, [ready]);
  if (fatal)
    return (
      <main className="fatal">
        <h1>Storage needs attention</h1>
        <p>{fatal}</p>
        <p>
          Allow website storage, check available space, and retry. APEX has not cleared your
          records.
        </p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>
    );
  if (!data)
    return (
      <div className="loading">
        <img src={`${import.meta.env.BASE_URL}apex.svg`} alt="" width="54" />
        <p>Preparing your training space…</p>
      </div>
    );
  const program = data.programs.find((p) => p.id === data.settings.programId) ?? data.programs[0];
  if (!program) return <p>No program found. Restore a valid backup.</p>;
  const active = data.sessions.filter((s) => s.status === 'draft');
  const [page, id, exerciseId] = route.split('/');
  const selected = ['exercise', 'exercise-info'].includes(page)
    ? 'exercises'
    : page === 'workout'
      ? 'today'
      : page;
  const context = {
    ...data,
    program,
    notify: setMessage,
    report: (e: unknown) => setMessage(errorMessage(e)),
  };
  const reminder =
    data.settings.backupReminder &&
    data.sessions.length > 0 &&
    (!data.settings.lastBackupAt ||
      Date.now() - Date.parse(data.settings.lastBackupAt) > 14 * 86400000);
  return (
    <DataContext.Provider value={context}>
      <div className={`${data.settings.compact ? 'app compact' : 'app'} screen-${page}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          <button className="brand" onClick={() => go('today')} aria-label="PROJECT APEX home">
            <img src={`${import.meta.env.BASE_URL}apex.svg`} alt="" />
            <div>
              <strong>
                PROJECT <b>APEX</b>
              </strong>
              <span>ATHLETIC RECOMPOSITION</span>
            </div>
          </button>
          <div className="connection">
            <span className={`status-dot ${!online ? 'offline' : ''}`} />
            <span>
              {!online ? 'Offline' : offlineReady ? 'Offline ready' : 'On-device training'}
            </span>
          </div>
        </header>
        {!online && (
          <div className="network-banner">
            <WifiOff size={14} /> Offline · tracking and backups stay available
          </div>
        )}
        {needRefresh && (
          <div className="update-banner">
            An update is ready.{' '}
            {active.length ? (
              'Finish or save your draft, then update from Settings.'
            ) : (
              <button onClick={() => void updateServiceWorker(true)}>Update now</button>
            )}
          </div>
        )}
        {active.length > 0 && !['workout', 'exercise', 'exercise-info'].includes(page) && (
          <button className="resume-banner" onClick={() => go(`workout/${active[0].id}`)}>
            <span className="status-dot" />
            Workout in progress · {active[0].title}
            <span>
              Resume <ArrowUpRight size={16} />
            </span>
          </button>
        )}
        <main id="main" className="main" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading">Loading…</div>}>
              {page === 'workout' && id ? (
                <Workout key={id} id={id} exerciseId={exerciseId} />
              ) : ['exercises', 'exercise', 'exercise-info'].includes(page) ? (
                <Exercises
                  key={`${page}-${id || 'library'}`}
                  id={id}
                  info={page === 'exercise-info'}
                />
              ) : page === 'program' ? (
                <Program />
              ) : page === 'progress' ? (
                <Progress />
              ) : page === 'settings' ? (
                <Settings
                  panel={id || 'menu'}
                  updateReady={needRefresh}
                  onUpdate={() => void updateServiceWorker(true)}
                />
              ) : (
                <Today />
              )}
            </Suspense>
          </ErrorBoundary>
          {reminder && page === 'today' && (
            <button className="backup-reminder" onClick={() => go('settings/backup')}>
              Keep a copy of your progress. Export a backup in Settings. <ArrowUpRight size={15} />
            </button>
          )}
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={selected === n.id ? 'page' : undefined}
              className={selected === n.id ? 'active' : ''}
              onClick={() => go(n.id)}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <KeyboardViewport />
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <button aria-label="Dismiss message" onClick={() => setMessage('')}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </DataContext.Provider>
  );
}
