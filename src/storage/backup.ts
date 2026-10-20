import { z } from 'zod';
import { db, type ApexDB } from './db';
import {
  cardioSchema,
  dateKey,
  exerciseSchema,
  now,
  programSchema,
  ropeSchema,
  sessionSchema,
  settingsSchema,
  timerSchema,
} from '../domain/model';
import { setProblem } from '../domain/calculations';
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const draftSchema = z.object({
  id: z.string().max(150),
  fields: z.record(z.string().max(100), z.string().max(10000)),
  updatedAt: z.string().datetime(),
});
export const backupSchema = z.object({
  format: z.literal('project-apex'),
  version: z.literal(2),
  exportedAt: z.string().datetime(),
  data: z.object({
    exercises: z.array(exerciseSchema).max(10000),
    programs: z.array(programSchema).min(1).max(1000),
    sessions: z.array(sessionSchema).max(50000),
    cardio: z.array(cardioSchema).max(50000),
    rope: z.array(ropeSchema).max(50000),
    settings: settingsSchema,
    timers: z.array(timerSchema).max(1),
    drafts: z.array(draftSchema).max(1000),
  }),
});
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(raw: string): Backup {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
    throw new Error('Backup exceeds the 20 MB safety limit.');
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (input && typeof input === 'object' && 'version' in input && input.version === 1) {
    const v = input as Record<string, unknown>;
    const data = v.data;
    if (data && typeof data === 'object') {
      input = {
        ...v,
        version: 2,
        data: { ...data, drafts: [], timers: 'timers' in data ? data.timers : [] },
      };
    }
  }
  const result = backupSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid or incompatible backup: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`,
    );
  const b = result.data;
  const { data } = b;
  for (const [key, records] of Object.entries(data)) {
    if (!Array.isArray(records)) continue;
    const ids = records.map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate IDs in ${key}.`);
  }
  const exerciseIds = new Set(data.exercises.map((e) => e.id));
  for (const p of data.programs) {
    if (new Set(p.days.map((d) => d.id)).size !== p.days.length)
      throw new Error('Duplicate day IDs.');
    for (const day of p.days)
      for (const rx of day.exercises) {
        if (!exerciseIds.has(rx.exerciseId) || rx.alternatives.some((id) => !exerciseIds.has(id)))
          throw new Error('A program references an absent exercise.');
      }
  }
  const program = data.programs.find((p) => p.id === data.settings.programId);
  if (!program || !program.days.some((d) => d.id === data.settings.selectedDayId))
    throw new Error('The active program or day is missing.');
  for (const s of data.sessions)
    for (const p of s.performances)
      for (const set of p.sets)
        if (set.done) {
          const problem = setProblem(p.exercise, set);
          if (problem) throw new Error(`Invalid completed set: ${problem}`);
        }
  const sessionIds = new Set(data.sessions.map((s) => s.id));
  for (const record of [...data.cardio, ...data.rope])
    if (record.sessionId && !sessionIds.has(record.sessionId))
      throw new Error('An activity references an absent session.');
  return b;
}
export async function createBackup(database: ApexDB = db): Promise<Backup> {
  return database.transaction('r', database.tables, async () => ({
    format: 'project-apex',
    version: 2,
    exportedAt: now(),
    data: {
      exercises: await database.exercises.toArray(),
      programs: await database.programs.toArray(),
      sessions: await database.sessions.toArray(),
      cardio: await database.cardio.toArray(),
      rope: await database.rope.toArray(),
      settings: (await database.settings.get('settings'))!,
      timers: await database.timers.toArray(),
      drafts: await database.drafts.toArray(),
    },
  }));
}
export async function importBackup(backup: Backup, mode: 'replace' | 'merge', database = db) {
  const b = parseBackup(JSON.stringify(backup));
  let added = 0,
    skipped = 0;
  await database.transaction('rw', database.tables, async () => {
    if (mode === 'replace') for (const table of database.tables) await table.clear();
    const collections = [
      'exercises',
      'programs',
      'sessions',
      'cardio',
      'rope',
      'timers',
      'drafts',
    ] as const;
    for (const key of collections) {
      const table = database.table(key);
      for (const record of b.data[key]) {
        if (mode === 'merge' && (await table.get(record.id))) {
          skipped++;
          continue;
        }
        await table.add(record);
        added++;
      }
    }
    if (mode === 'replace') await database.settings.put(b.data.settings);
  });
  return { added, skipped };
}
export const backupFilename = () =>
  `project-apex-backup-${dateKey()}-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}.json`;
export async function saveFile(contents: string, name: string, type: string, share = false) {
  const file = new File([contents], name, { type });
  if (share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'PROJECT APEX backup' });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function csv(rows: (string | number | null)[][]) {
  return (
    '\ufeff' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = value === null ? '' : String(value);
            if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
            return `"${s.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export async function exportCsv(kind: 'sets' | 'sessions' | 'cardio' | 'rope', database = db) {
  const b = await createBackup(database);
  let rows: (string | number | null)[][] = [];
  if (kind === 'sets') {
    rows = [
      [
        'session_id',
        'date',
        'exercise_id',
        'exercise',
        'type',
        'load_kg_per_implement',
        'load_mode',
        'sides',
        'reps_per_side',
        'seconds',
        'meters',
        'rir',
        'rpe',
        'warmup',
        'completed',
        'notes',
      ],
      ...b.data.sessions.flatMap((s) =>
        s.performances.flatMap((p) =>
          p.sets.map((set) => [
            s.id,
            s.date,
            p.exercise.id,
            p.exercise.name,
            p.exercise.type,
            set.loadKg,
            p.exercise.loadMode,
            p.exercise.sides,
            set.reps,
            set.seconds,
            set.meters,
            set.rir,
            set.rpe,
            String(set.warmup),
            String(set.done),
            set.notes,
          ]),
        ),
      ),
    ];
  }
  if (kind === 'sessions')
    rows = [
      [
        'session_id',
        'date',
        'title',
        'category',
        'status',
        'started_at_utc',
        'finished_at_utc',
        'notes',
      ],
      ...b.data.sessions.map((s) => [
        s.id,
        s.date,
        s.title,
        s.kind,
        s.status,
        s.startedAt,
        s.finishedAt,
        s.notes,
      ]),
    ];
  if (kind === 'cardio')
    rows = [
      [
        'id',
        'date',
        'activity',
        'minutes',
        'speed_kmh',
        'entered_distance_km',
        'incline_percent',
        'rpe',
        'average_heart_rate',
        'completed',
        'notes',
      ],
      ...b.data.cardio.map((c) => [
        c.id,
        c.date,
        c.activity,
        c.minutes,
        c.speedKmh,
        c.distanceKm,
        c.incline,
        c.rpe,
        c.heartRate,
        String(c.completed),
        c.notes,
      ]),
    ];
  if (kind === 'rope')
    rows = [
      [
        'id',
        'date',
        'rounds',
        'work_seconds',
        'rest_seconds',
        'active_seconds',
        'elapsed_seconds',
        'rpe',
        'tolerance',
        'completed',
        'notes',
      ],
      ...b.data.rope.map((r) => [
        r.id,
        r.date,
        r.rounds,
        r.workSeconds,
        r.restSeconds,
        r.rounds * r.workSeconds,
        r.elapsedSeconds,
        r.rpe,
        r.tolerance,
        String(r.completed),
        r.notes,
      ]),
    ];
  return csv(rows);
}
