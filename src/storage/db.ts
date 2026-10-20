import Dexie, { type Table } from 'dexie';
import { originalExercises } from '../data/exercises';
import { defaultSettings, makeOriginalProgram } from '../data/program';
import {
  now,
  uid,
  newSet,
  sessionSchema,
  type Exercise,
  type Program,
  type Session,
  type Cardio,
  type Rope,
  type Settings,
  type Timer,
  type TrainingDay,
  type Performance,
} from '../domain/model';
import { setProblem } from '../domain/calculations';
export interface FormDraft {
  id: string;
  fields: Record<string, string>;
  updatedAt: string;
}
export class ApexDB extends Dexie {
  exercises!: Table<Exercise, string>;
  programs!: Table<Program, string>;
  sessions!: Table<Session, string>;
  cardio!: Table<Cardio, string>;
  rope!: Table<Rope, string>;
  settings!: Table<Settings, string>;
  timers!: Table<Timer, string>;
  drafts!: Table<FormDraft, string>;
  constructor(name = 'project-apex') {
    super(name);
    this.version(1).stores({
      exercises: 'id,name,primary,archived',
      programs: 'id',
      sessions: 'id,date,status,dayId,programId',
      cardio: 'id,date,sessionId',
      rope: 'id,date,sessionId',
      settings: 'id',
      timers: 'id',
    });
    this.version(2)
      .stores({ drafts: 'id' })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((e) => {
            e.archived ??= false;
          });
      });
  }
}
export const db = new ApexDB();
export async function seed(database = db) {
  await database.transaction(
    'rw',
    [database.exercises, database.programs, database.settings],
    async () => {
      if (await database.settings.get('settings')) return;
      await database.exercises.bulkPut(structuredClone(originalExercises));
      await database.programs.put(makeOriginalProgram());
      await database.settings.put(defaultSettings());
    },
  );
}
export async function createSession(program: Program, day: TrainingDay, database = db) {
  const previous = (await database.sessions.where('status').equals('completed').toArray()).sort(
    (a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt),
  );
  const performances: Performance[] = [];
  for (const p of day.exercises) {
    const exercise = await database.exercises.get(p.exerciseId);
    if (!exercise) throw new Error('Exercise is missing. Repair the program before starting.');
    const last = previous
      .flatMap((s) => s.performances)
      .find(
        (ep) =>
          ep.exercise.id === exercise.id &&
          ep.sets.some((s) => s.done && !s.warmup) &&
          ep.exercise.type === exercise.type &&
          ep.exercise.sides === exercise.sides &&
          ep.exercise.loadMode === exercise.loadMode,
      );
    const old = last?.sets.filter((s) => s.done && !s.warmup) ?? [];
    performances.push({
      id: uid(),
      exercise: structuredClone(exercise),
      prescription: structuredClone(p),
      sets: Array.from({ length: p.sets }, (_, i) => ({
        ...newSet(),
        ...(old[i]
          ? {
              loadKg: old[i].loadKg,
              reps: old[i].reps,
              seconds: old[i].seconds,
              meters: old[i].meters,
            }
          : {}),
      })),
    });
  }
  const session: Session = {
    id: uid(),
    programId: program.id,
    dayId: day.id,
    title: day.title,
    kind: day.kind,
    date: now().slice(0, 10),
    startedAt: now(),
    finishedAt: null,
    status: 'draft',
    performances,
    warmup: [...day.warmup],
    mobility: [...day.mobility],
    checklist: {},
    notes: '',
    updatedAt: now(),
  };
  // Use the device's local calendar day, independently of the UTC timestamps.
  const local = new Date();
  session.date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  await database.sessions.add(session);
  return session;
}
export async function saveSession(session: Session, database = db) {
  const parsed = sessionSchema.parse({ ...session, updatedAt: now() });
  for (const p of parsed.performances)
    for (const s of p.sets)
      if (s.done) {
        const problem = setProblem(p.exercise, s);
        if (problem) throw new Error(`${p.exercise.name}: ${problem}`);
      }
  await database.sessions.put(parsed);
  return parsed;
}
export async function removeSession(id: string, database = db) {
  await database.transaction(
    'rw',
    [database.sessions, database.cardio, database.rope, database.drafts],
    async () => {
      const cardioIds = await database.cardio.where('sessionId').equals(id).primaryKeys();
      const ropeIds = await database.rope.where('sessionId').equals(id).primaryKeys();
      await database.sessions.delete(id);
      await database.cardio.where('sessionId').equals(id).delete();
      await database.rope.where('sessionId').equals(id).delete();
      await database.drafts.bulkDelete([
        `cardio-${id}`,
        `rope-${id}`,
        ...cardioIds.map((key) => `cardio-edit-${key}`),
        ...ropeIds.map((key) => `rope-edit-${key}`),
      ]);
    },
  );
}
/** Discard an unfinished workout and its linked records atomically. */
export async function discardDraftSession(id: string, database = db) {
  await database.transaction(
    'rw',
    [database.sessions, database.cardio, database.rope, database.drafts, database.timers],
    async () => {
      const session = await database.sessions.get(id);
      if (session && session.status !== 'draft')
        throw new Error(
          'This workout is already completed. Manage saved workouts in Progress → History.',
        );
      await removeSession(id, database);
      const timer = await database.timers.get('rest');
      if (timer) await database.timers.put({ ...timer, endAt: null, remaining: timer.duration });
    },
  );
}
export async function restoreOriginal(database = db) {
  const program = makeOriginalProgram(`apex-${uid()}`);
  await database.transaction(
    'rw',
    [database.programs, database.exercises, database.settings],
    async () => {
      for (const ex of originalExercises)
        if (!(await database.exercises.get(ex.id))) await database.exercises.add(ex);
      await database.programs.add(program);
      await database.settings.update('settings', {
        programId: program.id,
        selectedDayId: program.days[0].id,
      });
    },
  );
  return program;
}
export async function clearPersonalData(database = db) {
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await database.exercises.bulkAdd(structuredClone(originalExercises));
    await database.programs.add(makeOriginalProgram());
    await database.settings.add(defaultSettings());
  });
}
