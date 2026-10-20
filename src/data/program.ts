import {
  dateKey,
  now,
  type Prescription,
  type Program,
  type Settings,
  type TrainingDay,
} from '../domain/model';
import { originalExercises } from './exercises';
function p(
  exerciseId: string,
  sets: number,
  min: number,
  max: number,
  alternatives: string[] = [],
  unit: Prescription['unit'] = 'reps',
): Prescription {
  const e = originalExercises.find((e) => e.id === exerciseId)!;
  return {
    id: `rx-${exerciseId}`,
    exerciseId,
    sets,
    min,
    max,
    unit,
    rest:
      e.category === 'heavy'
        ? 180
        : e.category === 'isolation'
          ? 75
          : e.type === 'carry'
            ? 90
            : 120,
    alternatives,
  };
}
const warmA = [
  'Arm circles — 10 each direction',
  'Band pull-apart — 15 repetitions',
  'Wall slide — 10 repetitions',
  'Ankle rocks — 10 per side',
  'Front/back leg swings — 10 per side',
  '90/90 hip switches — 8 per side',
  'Progressive warm-up sets — before heavy compound lifts',
];
const stretches = [
  'Straight-leg calf stretch — 40 seconds per side',
  'Bent-knee soleus stretch — 40 seconds per side',
  'Hip-flexor stretch — 40 seconds per side',
  'Hamstring stretch — 40 seconds per side',
  'Figure-4 glute stretch — 40 seconds per side',
  'Adductor stretch — 40 seconds',
  'Lat stretch — 40 seconds per side',
  'Doorway chest stretch — 40 seconds per side',
];
const d = (
  id: string,
  title: string,
  kind: TrainingDay['kind'],
  duration: string,
  focus: string,
  exercises: Prescription[] = [],
  warmup: string[] = [],
  mobility: string[] = [],
  cardio: TrainingDay['cardio'] = null,
): TrainingDay => ({
  id,
  title,
  kind,
  duration,
  focus,
  exercises,
  warmup,
  mobility,
  cardio,
  weekday: null,
});
export const originalDays: TrainingDay[] = [
  d(
    'day-1',
    'Full Body A',
    'strength',
    '65–80 min',
    'Strength + V-Taper',
    [
      p('pull-up', 3, 5, 8, ['assisted-pull-up']),
      p('incline-db-press', 3, 6, 10),
      p('squat', 3, 5, 8, ['hack-squat']),
      p('chest-row', 3, 8, 12),
      p('rdl', 2, 6, 10),
      p('lateral-raise', 3, 12, 20),
      p('biceps-curl', 2, 8, 12),
      p('standing-calf', 2, 10, 15),
      p('ab-wheel', 2, 6, 12),
    ],
    warmA,
  ),
  d(
    'day-2',
    'Aerobic Conditioning',
    'cardio',
    '40–55 min',
    'Jump rope + Mobility',
    [],
    [
      'Ankle rocks — 10 per side',
      'Walking calf raises — 15 repetitions',
      'Front/back leg swings — 10 per side',
      'Side-to-side leg swings — 10 per side',
      'Walking lunges — 8 per side',
    ],
    stretches,
    { min: 30, max: 35, speedMin: 5.5, speedMax: 6, rpe: '3–4', activity: 'Treadmill running' },
  ),
  d(
    'day-3',
    'Full Body B',
    'strength',
    '65–80 min',
    'Hypertrophy + Single-Leg Strength',
    [
      p('lat-pulldown', 3, 6, 10, ['chin-up']),
      p('flat-db-press', 3, 6, 10, ['dip']),
      p('split-squat', 2, 8, 10),
      p('cable-row', 3, 8, 12),
      p('leg-curl', 3, 10, 15),
      p('rear-fly', 2, 12, 20, ['face-pull']),
      p('lateral-raise', 2, 12, 20),
      p('biceps-curl', 2, 10, 15),
      p('triceps', 2, 10, 15),
      p('tibialis', 2, 15, 25),
    ],
    [
      'Arm circles — 10 each direction',
      'Thoracic open-book rotations — 8 per side',
      'Band pull-apart — 15 repetitions',
      'Hip switches — 8 per side',
      'Adductor rock-backs — 8 per side',
      'Bodyweight squat — 10 repetitions',
      'Progressive warm-up sets — before compound lifts',
    ],
  ),
  d(
    'day-4',
    'Active Recovery',
    'recovery',
    '15–25 min',
    'Move well. Recover well.',
    [],
    [],
    [
      'Knee-to-wall ankle mobilization — 2 × 10 per side',
      '90/90 hip switches — 2 × 8 per side',
      'Adductor rock-backs — 2 × 10',
      'Thoracic open-book rotations — 2 × 8 per side',
      'Wall slide — 2 × 10',
      'Scapular push-up — 2 × 10',
      'Hip flexors — optional 45 seconds per side',
      'Calves — optional 45 seconds per side',
      'Hamstrings — optional 45 seconds per side',
      'Chest — optional 45 seconds per side',
    ],
  ),
  d(
    'day-5',
    'Full Body C',
    'strength',
    '65–80 min',
    'Athletic Strength + Relative Strength',
    [
      p('trap-deadlift', 3, 4, 6),
      p('chin-up', 3, 5, 10, ['assisted-chin-up']),
      p('landmine', 3, 8, 12),
      p('reverse-lunge', 2, 8, 8, ['step-up']),
      p('one-cable-row', 3, 8, 12, ['one-db-row']),
      p('push-up', 2, 1, 50, [], 'submax'),
      p('hammer-curl', 2, 10, 15),
      p('soleus-raise', 2, 12, 20),
      p('farmer-carry', 2, 30, 45, [], 'seconds'),
      p('pallof', 2, 10, 15),
    ],
    [
      'Ankle rocks — 10 per side',
      'Front/back leg swings — 10 per side',
      'Walking lunges — 8 per side',
      'Arm circles — 10 each direction',
      'Scapular push-up — 10 repetitions',
      'Thoracic rotations — 8 per side',
      'Progressive warm-up sets — before compound lifts',
    ],
  ),
  d(
    'day-6',
    'Easy Cardio',
    'cardio',
    '35–50 min',
    'Jump rope + Aerobic base',
    [],
    ['Light movement — 5 minutes, with dynamic ankle and hip mobility'],
    [],
    { min: 30, max: 40, speedMin: null, speedMax: null, rpe: '3–4', activity: 'Outdoor running' },
  ),
  d('day-7', 'Complete Rest', 'rest', 'No target', 'Recovery is part of the program.'),
];
export function makeOriginalProgram(id = 'apex-original'): Program {
  return {
    id,
    name: 'Project APEX',
    block: 'Foundation',
    weeks: 4,
    startDate: dateKey(),
    archived: false,
    days: structuredClone(originalDays),
    updatedAt: now(),
  };
}
export function defaultSettings(): Settings {
  return {
    id: 'settings',
    weightUnit: 'kg',
    speedUnit: 'mph',
    distanceUnit: 'mi',
    weekStart: 3,
    autoRest: false,
    loadIncrementKg: 2.5,
    ropeStage: 0,
    programId: 'apex-original',
    selectedDayId: 'day-1',
    backupReminder: true,
    lastBackupAt: null,
    compact: false,
  };
}
export const ropeStages = [
  { label: 'Weeks 1–2', rounds: 5, work: 30 },
  { label: 'Weeks 3–4', rounds: 6, work: 45 },
  { label: 'Weeks 5–6', rounds: 6, work: 60 },
  { label: 'Weeks 7–8', rounds: 5, work: 90 },
  { label: 'Weeks 9–10', rounds: 5, work: 120 },
  { label: 'Long-term benchmark', rounds: 3, work: 180 },
];
export const trainingRules = [
  'Heavy compounds: about 2–3 RIR. Other compounds: 1–3 RIR. Isolation: 0–2 RIR. Avoid frequent technical failure on heavy lifts.',
  'Build repetitions within the range before considering a small load increase. Suggestions never change your weights automatically.',
  'Keep cardio conversational at RPE 3–4. Build comfortable duration from 30–35 to 35–40, then 40–45 minutes; change one variable at a time.',
  'Rope stages are references, not deadlines. Advance only when calf, shin, ankle and Achilles tolerance and recovery are good.',
  'Working sets are starting prescriptions. If fatigue persists, consider reducing accessory volume. If a priority muscle stalls despite good recovery, 1–2 extra weekly sets may be considered.',
  'Reassess strength, aerobic endurance, rope tolerance and consistency after the four-week foundation block.',
];
