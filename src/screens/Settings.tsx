import { useEffect, useState } from 'react';
import {
  Download,
  HardDrive,
  ShieldCheck,
  Smartphone,
  Upload,
  SlidersHorizontal,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';
import { db, clearPersonalData, restoreOriginal } from '../storage/db';
import {
  backupFilename,
  createBackup,
  exportCsv,
  importBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  saveFile,
  type Backup,
} from '../storage/backup';
import { now, type Settings as SettingsType } from '../domain/model';
import { fromKg, rounded, toKg } from '../domain/calculations';
import { ropeStages } from '../data/program';
import { Back, Field, go, Modal, PageTitle, Section, useData } from '../components/ui';
export default function Settings({
  updateReady,
  onUpdate,
  panel = 'menu',
}: {
  panel?: string;
  updateReady: boolean;
  onUpdate: () => void;
}) {
  const { settings, rope, report, notify } = useData();
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>(
    {},
  );
  const [backup, setBackup] = useState<Backup | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmation, setConfirmation] = useState('');
  const [clear, setClear] = useState(false);
  const [clearText, setClearText] = useState('');
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState(false);
  const [stageConfirm, setStageConfirm] = useState<number | null>(null);
  useEffect(() => {
    if (navigator.storage)
      void Promise.all([navigator.storage.estimate?.(), navigator.storage.persisted?.()])
        .then(([estimate, persisted]) => setStorage({ ...estimate, persisted }))
        .catch(() => {});
  }, []);
  function change(patch: Partial<SettingsType>) {
    void db.settings.update('settings', patch).catch(report);
  }
  async function exportBackup(share = false) {
    setBusy(true);
    try {
      const b = await createBackup();
      await saveFile(JSON.stringify(b, null, 2), backupFilename(), 'application/json', share);
      await db.settings.update('settings', { lastBackupAt: now() });
      notify(
        share
          ? 'Backup shared. Verify it is saved in your chosen destination.'
          : 'Backup download started. Verify the JSON file in Files or Downloads.',
      );
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function fileSelected(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Select a JSON backup smaller than 20 MB.');
      const parsed = parseBackup(await file.text());
      setBackup(parsed);
      setMode('merge');
      setConfirmation('');
    } catch (e) {
      report(e);
    }
  }
  async function restore() {
    if (!backup) return;
    if (mode === 'replace' && confirmation !== 'REPLACE') return;
    setBusy(true);
    try {
      const result = await importBackup(backup, mode);
      setBackup(null);
      notify(
        `${mode === 'merge' ? 'Merge' : 'Restore'} complete: ${result.added} records imported, ${result.skipped} existing IDs kept.`,
      );
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  const lastRope = [...rope]
    .filter((r) => r.completed)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
  const panels = [
    {
      id: 'preferences',
      title: 'Training preferences',
      description: 'Units, timer & progression',
      icon: SlidersHorizontal,
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      description: 'Keep a copy of your progress',
      icon: ShieldCheck,
    },
    {
      id: 'program',
      title: 'Program management',
      description: 'Blocks, templates & archives',
      icon: CalendarDays,
    },
    {
      id: 'storage',
      title: 'Local storage',
      description: 'Persistence & data controls',
      icon: HardDrive,
    },
    {
      id: 'install',
      title: 'Install on iPhone',
      description: 'Home Screen, offline & updates',
      icon: Smartphone,
    },
  ];
  return (
    <>
      {panel !== 'menu' && <Back to="settings" label="Settings" />}
      <PageTitle
        eyebrow={panel === 'menu' ? 'YOUR APP' : undefined}
        title={panels.find((p) => p.id === panel)?.title ?? 'Settings'}
        subtitle={panel === 'menu' ? 'Just the way you train.' : undefined}
      />
      {panel === 'menu' && (
        <>
          <div className="settings-menu">
            {panels.map((p) => (
              <button key={p.id} onClick={() => go(`settings/${p.id}`)}>
                <span className="settings-menu-icon">
                  <p.icon size={21} />
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <small>{p.description}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          <div className="settings-privacy">
            <ShieldCheck size={21} />
            <p>
              Private by design.
              <br />
              <span>Your training stays on this iPhone.</span>
            </p>
          </div>
        </>
      )}
      <div className="settings-layout" data-panel={panel}>
        <div>
          <Section title="Training preferences">
            <div className="card form-stack">
              <div className="form-grid">
                <Field label="Resistance unit">
                  <select
                    value={settings.weightUnit}
                    onChange={(e) => change({ weightUnit: e.target.value as 'kg' | 'lb' })}
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lb">Pounds (lb)</option>
                  </select>
                </Field>
                <Field label="Speed unit">
                  <select
                    value={settings.speedUnit}
                    onChange={(e) => change({ speedUnit: e.target.value as 'mph' | 'km/h' })}
                  >
                    <option value="mph">Miles per hour</option>
                    <option value="km/h">Kilometers per hour</option>
                  </select>
                </Field>
                <Field label="Distance unit">
                  <select
                    value={settings.distanceUnit}
                    onChange={(e) => change({ distanceUnit: e.target.value as 'mi' | 'km' })}
                  >
                    <option value="mi">Miles</option>
                    <option value="km">Kilometers</option>
                  </select>
                </Field>
                <Field label="Training week begins">
                  <select
                    value={settings.weekStart}
                    onChange={(e) => change({ weekStart: +e.target.value })}
                  >
                    {[
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ].map((d, i) => (
                      <option value={i} key={d}>
                        {d}
                        {i === 3 ? ' · APEX default' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={`Available load increment (${settings.weightUnit})`}
                  hint="Per hand for paired dumbbells. Recommendations are advisory."
                >
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step="any"
                    value={rounded(fromKg(settings.loadIncrementKg, settings.weightUnit), 3)}
                    onChange={(e) => {
                      if (+e.target.value > 0 && +e.target.value <= 100)
                        change({ loadIncrementKg: toKg(+e.target.value, settings.weightUnit) });
                    }}
                  />
                </Field>
                <Field label="Rope reference stage">
                  <select
                    value={settings.ropeStage}
                    onChange={(e) => {
                      const next = +e.target.value;
                      if (next > settings.ropeStage) setStageConfirm(next);
                      else change({ ropeStage: next });
                    }}
                  >
                    {ropeStages.map((s, i) => (
                      <option key={s.label} value={i}>
                        {s.label} · {s.rounds} × {s.work}s
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.autoRest}
                  onChange={(e) => change({ autoRest: e.target.checked })}
                />
                Start rest timer when completing a set
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.compact}
                  onChange={(e) => change({ compact: e.target.checked })}
                />
                Compact spacing on larger screens
              </label>
              <button onClick={() => go('program')}>Program start date & training blocks ↗</button>
              <p className="small muted">
                Measurements are stored in kg, km and km/h. Changing display units does not alter
                saved performance.
              </p>
            </div>
          </Section>
          <Section title="Backup & Restore">
            <div className="card form-stack">
              <div className="icon-heading">
                <ShieldCheck size={22} />
                <div>
                  <h3>Keep a copy of your progress.</h3>
                  <p className="muted">
                    A backup is a file you save yourself. Nothing is uploaded automatically.
                  </p>
                </div>
              </div>
              <div className="button-row">
                <button className="primary" disabled={busy} onClick={() => void exportBackup()}>
                  <Download size={16} />
                  Export complete backup
                </button>
                {typeof navigator.share === 'function' && (
                  <button disabled={busy} onClick={() => void exportBackup(true)}>
                    Share backup
                  </button>
                )}
              </div>
              <p className="small muted">
                Last successful export action:{' '}
                {settings.lastBackupAt
                  ? new Date(settings.lastBackupAt).toLocaleString()
                  : 'No backup exported yet'}
                . Downloads cannot verify that a file was kept; check your Files app.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.backupReminder}
                  onChange={(e) => change({ backupReminder: e.target.checked })}
                />
                Remind me in the app after 14 days without an export
              </label>
              <hr />
              <Field
                label="Import a JSON backup"
                hint="Validated before importing. Maximum file size: 20 MB."
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    void fileSelected(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </Field>
              <div className="icon-heading">
                <Upload size={19} />
                <p className="small muted">
                  Merge keeps existing IDs and imports new records. Restore replaces local data only
                  after explicit confirmation.
                </p>
              </div>
              <hr />
              <h3>Spreadsheet exports</h3>
              <div className="button-row">
                {(['sets', 'sessions', 'cardio', 'rope'] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() =>
                      void exportCsv(kind)
                        .then((content) =>
                          saveFile(
                            content,
                            `project-apex-${kind}-${now().slice(0, 10)}.csv`,
                            'text/csv',
                          ),
                        )
                        .catch(report)
                    }
                  >
                    {kind === 'sets'
                      ? 'Strength sets'
                      : kind === 'sessions'
                        ? 'Workout sessions'
                        : kind === 'cardio'
                          ? 'Cardio'
                          : 'Jump rope'}{' '}
                    CSV
                  </button>
                ))}
              </div>
              <p className="small muted">
                CSV uses normalized kg/km/km/h and includes incomplete records with status columns.
                Use JSON for full restoration.
              </p>
            </div>
          </Section>
          <Section title="Program management">
            <div className="card button-row">
              <button onClick={() => go('program')}>Manage programs & archives</button>
              <button onClick={() => setOriginal(true)}>Restore original APEX template</button>
            </div>
          </Section>
        </div>
        <aside>
          <Section title="Local storage">
            <div className="card">
              <HardDrive size={24} />
              <h3>Only on this device.</h3>
              <p>
                Workout records live in this browser’s IndexedDB. There is no account, cloud
                database, tracking SDK, or synchronization.
              </p>
              <p className="muted">
                Safari or iOS can remove website data. Device loss, clearing browser storage, and
                changing the app’s web address can make your records unavailable. Export backups
                regularly.
              </p>
              <p className="small muted">
                {storage.usage !== undefined
                  ? `${(storage.usage / 1024 / 1024).toFixed(1)} MB used${storage.quota ? ` · ${(storage.quota / 1024 / 1024 / 1024).toFixed(1)} GB reported quota` : ''}`
                  : 'Storage estimate unavailable.'}
                <br />
                {storage.persisted
                  ? 'Persistent storage granted by this browser.'
                  : 'Persistent storage is not guaranteed.'}
              </p>
              <button
                onClick={() => {
                  if (!navigator.storage?.persist) {
                    notify(
                      'This browser does not expose a persistent-storage request. Keep manual backups.',
                    );
                    return;
                  }
                  void navigator.storage
                    .persist()
                    .then((granted) => {
                      setStorage({ ...storage, persisted: granted });
                      notify(
                        granted
                          ? 'Persistent storage granted. Keep backups for device loss.'
                          : 'Browser did not grant persistence. Core storage still works; keep backups.',
                      );
                    })
                    .catch(report);
                }}
              >
                Request persistent storage
              </button>
              <button className="danger text-button section" onClick={() => setClear(true)}>
                Clear personal data
              </button>
            </div>
          </Section>
          <Section title="Install on iPhone">
            <div className="card">
              <Smartphone size={24} />
              <h3>Always one tap away.</h3>
              <ol className="simple-list">
                <li>Open the deployed HTTPS address in Safari.</li>
                <li>Tap Share, then Add to Home Screen (look under More if needed).</li>
                <li>Keep Open as Web App enabled if offered, then tap Add.</li>
                <li>Open APEX and wait for “Offline ready” before testing Airplane Mode.</li>
              </ol>
              <p className="muted small">
                Use the same installed app consistently. Safari and Home Screen storage behavior may
                vary by iOS version; export and restore a JSON backup if moving between contexts.
              </p>
              <h3>Offline & updates</h3>
              <p className="muted small">
                Guides, charts, logging and backups work after the initial cache completes. Videos
                need internet. If offline readiness fails, reconnect and reload once.
              </p>
              {updateReady ? (
                <button onClick={onUpdate}>Apply ready update & reload</button>
              ) : (
                <p className="small muted">
                  Updates are offered when a new version is available. Application caches and
                  personal records are separate.
                </p>
              )}
              <p className="small muted">
                Finish edits before refreshing. The app never erases IndexedDB to update its assets.
              </p>
            </div>
          </Section>
        </aside>
      </div>
      {backup && (
        <Modal title="Review backup import" onClose={() => setBackup(null)}>
          <p>
            Exported {new Date(backup.exportedAt).toLocaleString()} · Format v{backup.version}
          </p>
          <div className="card import-counts">
            {Object.entries(backup.data).map(
              ([name, records]) =>
                Array.isArray(records) && (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>{records.length}</strong>
                  </div>
                ),
            )}
          </div>
          <Field label="Import mode">
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="merge">Merge · keep existing IDs and settings</option>
              <option value="replace">
                Restore / Replace · use backup as complete local state
              </option>
            </select>
          </Field>
          <p className="muted small">
            Merge skips matching IDs even if backup records differ; it does not overwrite current
            edits. Restore replaces settings, drafts, programs and all personal logs.
          </p>
          {mode === 'replace' && (
            <Field label="Type REPLACE to confirm replacing all local data">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
          <button
            className={mode === 'replace' ? 'danger' : 'primary'}
            disabled={busy || (mode === 'replace' && confirmation !== 'REPLACE')}
            onClick={() => void restore()}
          >
            {busy
              ? 'Importing…'
              : mode === 'merge'
                ? 'Merge backup'
                : 'Replace all data from backup'}
          </button>
        </Modal>
      )}
      {clear && (
        <Modal title="Clear all personal data?" onClose={() => setClear(false)}>
          <p>
            This removes every workout, custom exercise, program, draft and preference from this
            device and restores the initial template. Export a backup first.
          </p>
          <Field label="Type DELETE ALL to confirm">
            <input value={clearText} onChange={(e) => setClearText(e.target.value)} />
          </Field>
          <button
            className="danger"
            disabled={clearText !== 'DELETE ALL'}
            onClick={() =>
              void clearPersonalData()
                .then(() => {
                  setClear(false);
                  notify('Local personal data cleared. Original template restored.');
                })
                .catch(report)
            }
          >
            Delete all personal data
          </button>
        </Modal>
      )}
      {original && (
        <Modal title="Restore original program" onClose={() => setOriginal(false)}>
          <p>
            A new original APEX block will become active. All existing programs and workout history
            are kept.
          </p>
          <button
            className="primary"
            onClick={() =>
              void restoreOriginal()
                .then(() => {
                  setOriginal(false);
                  notify('Original program restored.');
                })
                .catch(report)
            }
          >
            Restore original program
          </button>
        </Modal>
      )}
      {stageConfirm !== null && (
        <Modal title="Review rope progression" onClose={() => setStageConfirm(null)}>
          <p>
            Advance only with good calf, shin, ankle and Achilles tolerance and adequate recovery.
            The reference stage is optional.
          </p>
          {lastRope?.tolerance === 'poor' ? (
            <p className="error">
              Your latest recorded tolerance is poor. Log a recovered session with good tolerance
              before advancing this reference.
            </p>
          ) : (
            <button
              className="primary"
              onClick={() => {
                change({ ropeStage: stageConfirm });
                setStageConfirm(null);
              }}
            >
              Confirm good tolerance & select stage
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
