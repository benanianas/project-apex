import { z } from 'zod';
const id = z.string().min(1).max(150);
const text = z.string().max(10000);
const name = z.string().min(1).max(160);
const nonnegative = z.number().finite().min(0).max(100000);
const opt = nonnegative.nullable();
export const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00`);
    return (
      !isNaN(+d) &&
      d.getFullYear() === +s.slice(0, 4) &&
      d.getMonth() + 1 === +s.slice(5, 7) &&
      d.getDate() === +s.slice(8, 10)
    );
  }, 'Invalid calendar date');
const timestamp = z.string().datetime();
export const loggingType = z.enum([
  'resistance',
  'bodyweight',
  'assisted',
  'weighted-bodyweight',
  'timed',
  'carry',
  'distance',
]);
export const exerciseSchema = z.object({
  id,
  name,
  pattern: name,
  primary: name,
  secondary: z.array(name).max(20),
  equipment: name,
  type: loggingType,
  loadMode: z.enum(['total', 'per-hand']),
  sides: z.union([z.literal(1), z.literal(2)]),
  category: z.enum(['heavy', 'compound', 'isolation', 'mobility', 'conditioning']),
  diagram: name,
  steps: z.array(text).min(1).max(20),
  cues: z.array(text).max(20),
  mistakes: z.array(text).max(20),
  safety: text,
  alternatives: z.array(id).max(30),
  custom: z.boolean(),
  archived: z.boolean().default(false),
});
export const prescriptionSchema = z
  .object({
    id,
    exerciseId: id,
    sets: z.number().int().min(1).max(50),
    min: z.number().int().min(1).max(10000),
    max: z.number().int().min(1).max(10000),
    unit: z.enum(['reps', 'seconds', 'meters', 'submax']),
    rest: z.number().int().min(0).max(3600),
    alternatives: z.array(id).max(30),
  })
  .refine((p) => p.max >= p.min, 'Upper target must be at least the lower target');
export const daySchema = z.object({
  id,
  title: name,
  kind: z.enum(['strength', 'cardio', 'recovery', 'rest']),
  duration: name,
  focus: text,
  warmup: z.array(text).max(40),
  mobility: z.array(text).max(40),
  exercises: z.array(prescriptionSchema).max(80),
  cardio: z
    .object({
      min: nonnegative,
      max: nonnegative,
      speedMin: opt,
      speedMax: opt,
      rpe: name,
      activity: name,
    })
    .refine(
      (c) => c.max >= c.min && c.min > 0,
      'Cardio target must have a positive minimum and ordered range',
    )
    .nullable(),
  weekday: z.number().int().min(0).max(6).nullable(),
});
export const programSchema = z.object({
  id,
  name,
  block: name,
  weeks: z.number().int().min(1).max(104),
  startDate: localDate,
  archived: z.boolean(),
  days: z.array(daySchema).min(1).max(60),
  updatedAt: timestamp,
});
export const setSchema = z.object({
  id,
  loadKg: opt,
  reps: z.number().int().min(0).max(10000).nullable(),
  seconds: opt,
  meters: opt,
  rir: z.number().min(0).max(10).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  warmup: z.boolean(),
  done: z.boolean(),
  notes: text,
});
export const performanceSchema = z.object({
  id,
  exercise: exerciseSchema,
  prescription: prescriptionSchema,
  sets: z.array(setSchema).max(100),
});
export const sessionSchema = z.object({
  id,
  programId: id,
  dayId: id,
  title: name,
  kind: daySchema.shape.kind,
  date: localDate,
  startedAt: timestamp,
  finishedAt: timestamp.nullable(),
  status: z.enum(['draft', 'completed']),
  performances: z.array(performanceSchema).max(100),
  warmup: z.array(text).max(40),
  mobility: z.array(text).max(40),
  checklist: z.record(z.string(), z.boolean()),
  notes: text,
  updatedAt: timestamp,
});
export const cardioSchema = z.object({
  id,
  sessionId: id.nullable(),
  date: localDate,
  activity: name,
  minutes: z.number().finite().positive().max(1440),
  speedKmh: opt,
  distanceKm: opt,
  incline: z.number().min(-30).max(40).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  heartRate: z.number().int().min(20).max(250).nullable(),
  notes: text,
  completed: z.boolean(),
  updatedAt: timestamp,
});
export const ropeSchema = z
  .object({
    id,
    sessionId: id.nullable(),
    date: localDate,
    rounds: z.number().int().min(1).max(1000),
    workSeconds: z.number().positive().max(3600),
    restSeconds: z.number().min(0).max(3600),
    elapsedSeconds: opt,
    rpe: z.number().min(1).max(10).nullable(),
    tolerance: z.enum(['unknown', 'good', 'poor']),
    notes: text,
    completed: z.boolean(),
    updatedAt: timestamp,
  })
  .refine(
    (r) => r.elapsedSeconds === null || r.elapsedSeconds >= r.rounds * r.workSeconds,
    'Elapsed time cannot be shorter than active time',
  );
export const settingsSchema = z.object({
  id: z.literal('settings'),
  weightUnit: z.enum(['kg', 'lb']),
  speedUnit: z.enum(['mph', 'km/h']),
  distanceUnit: z.enum(['mi', 'km']),
  weekStart: z.number().int().min(0).max(6),
  autoRest: z.boolean(),
  loadIncrementKg: z.number().positive().max(100),
  ropeStage: z.number().int().min(0).max(5),
  programId: id,
  selectedDayId: id,
  backupReminder: z.boolean(),
  lastBackupAt: timestamp.nullable(),
  compact: z.boolean(),
});
export const timerSchema = z.object({
  id: z.literal('rest'),
  duration: nonnegative,
  remaining: nonnegative,
  endAt: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export type Prescription = z.infer<typeof prescriptionSchema>;
export type TrainingDay = z.infer<typeof daySchema>;
export type Program = z.infer<typeof programSchema>;
export type SetRecord = z.infer<typeof setSchema>;
export type Performance = z.infer<typeof performanceSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Cardio = z.infer<typeof cardioSchema>;
export type Rope = z.infer<typeof ropeSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Timer = z.infer<typeof timerSchema>;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const newSet = (): SetRecord => ({
  id: uid(),
  loadKg: null,
  reps: null,
  seconds: null,
  meters: null,
  rir: null,
  rpe: null,
  warmup: false,
  done: false,
  notes: '',
});
