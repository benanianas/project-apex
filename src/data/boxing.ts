import {
  dateKey,
  now,
  type Exercise,
  type Prescription,
  type Program,
  type TrainingDay,
  type TrainingTask,
} from '../domain/model';
import { originalExercises } from './exercises';
export const BOXING_UPDATE = 'boxing-readiness-2026-10';
export const BOXING_PROGRAM = 'apex-boxing-readiness-v1';
const copy = (id: string) => structuredClone(originalExercises.find((e) => e.id === id)!);
export const readinessExercises: Exercise[] = [
  {
    ...copy('biceps-curl'),
    id: 'dumbbell-curl',
    name: 'Dumbbell biceps curl',
    alternatives: ['barbell-curl', 'hammer-curl'],
  },
  {
    ...copy('biceps-curl'),
    id: 'barbell-curl',
    name: 'Barbell biceps curl',
    equipment: 'Barbell or EZ bar',
    loadMode: 'total',
    alternatives: ['dumbbell-curl'],
    steps: [
      'Stand with a comfortable underhand grip on a bar and elbows near your sides.',
      'Curl with a still torso and controlled elbows.',
      'Lower under control. Log the total bar and plates, not a per-hand weight.',
    ],
  },
  {
    ...copy('lateral-raise'),
    id: 'cable-lateral-raise',
    name: 'Cable lateral raise',
    equipment: 'Cable machine',
    loadMode: 'total',
    sides: 2,
    alternatives: ['lateral-raise'],
    steps: [
      'Stand beside a low cable with a handle in the far hand.',
      'Raise the arm out and slightly forward through a comfortable range.',
      'Lower under control and repeat on the other side. Log one cable stack and repetitions per side.',
    ],
  },
  {
    ...copy('face-pull'),
    id: 'band-external-rotation',
    name: 'Band external rotation',
    pattern: 'Shoulder rotation',
    primary: 'Rotator cuff',
    secondary: ['Shoulders'],
    equipment: 'Light resistance band',
    type: 'bodyweight',
    loadMode: 'total',
    sides: 2,
    category: 'isolation',
    alternatives: [],
    steps: [
      'Secure a light band around elbow height and stand side-on.',
      'Keep your elbow bent and close to your side; rotate your forearm outward gently.',
      'Return under control and repeat on the other side. Record band choice in notes.',
    ],
    cues: ['Keep the upper arm still and use light resistance.'],
    mistakes: ['Twisting the torso.', 'Forcing range or using a heavy band.'],
    safety: 'Use a secure anchor and a comfortable pain-free range.',
  },
  {
    ...copy('squat'),
    id: 'squat-jump',
    name: 'Squat jump',
    equipment: 'Clear level floor',
    type: 'bodyweight',
    category: 'conditioning',
    alternatives: [],
    steps: [
      'Stand with room around you and bend the knees and hips slightly.',
      'Make a small controlled vertical jump.',
      'Land softly and reset fully before the next repetition.',
    ],
    cues: [
      'Use low volume and full recovery.',
      'This is optional preparation after the return-to-training period.',
    ],
    mistakes: ['Rushing into repeated jumps.', 'Continuing with painful or uncontrolled landings.'],
    safety:
      'Only introduce after about two weeks if recovery and joint tolerance are good. Skip if uncomfortable.',
  },
];
function rx(
  exerciseId: string,
  sets: number,
  min: number,
  max: number,
  rest: number,
  priority: 'mandatory' | 'optional' = 'mandatory',
  alternatives: string[] = [],
  unit: Prescription['unit'] = 'reps',
): Prescription {
  return {
    id: `boxing-${exerciseId}`,
    exerciseId,
    sets,
    min,
    max,
    rest,
    priority,
    alternatives,
    unit,
  };
}
const task = (
  id: string,
  label: string,
  kind: TrainingTask['kind'],
  minutes: number,
  priority: TrainingTask['priority'] = 'mandatory',
): TrainingTask => ({
  id,
  label,
  kind,
  minutes,
  priority,
  ...(kind === 'rope' ? { target: { rounds: 5, workSeconds: 30, recoverySeconds: 60 } } : {}),
});
const day = (
  n: number,
  title: string,
  kind: TrainingDay['kind'],
  duration: string,
  focus: string,
  exercises: Prescription[] = [],
): TrainingDay => ({
  id: `boxing-day-${n}`,
  title,
  kind,
  duration,
  focus,
  exercises,
  warmup:
    kind === 'strength'
      ? [
          'Dynamic mobility — 5–8 minutes: ankles, hips, thoracic spine and shoulders',
          'Progressive warm-up sets — before heavy compound lifts',
        ]
      : [],
  mobility: [],
  cardio: null,
  weekday: null,
});
const easy = {
  min: 30,
  max: 40,
  speedMin: null,
  speedMax: null,
  rpe: '3–4',
  activity: 'Treadmill running',
};
export function makeBoxingProgram(): Program {
  const days: TrainingDay[] = [
    {
      ...day(
        1,
        'Full-body strength + power',
        'strength',
        '65–75 min',
        'Athletic strength and upper-back capacity. Power stays optional.',
        [
          rx('squat', 3, 5, 8, 180, 'mandatory', ['hack-squat']),
          rx('lat-pulldown', 3, 8, 12, 120, 'mandatory', ['assisted-pull-up']),
          rx('incline-db-press', 3, 6, 10, 120),
          rx('rdl', 2, 6, 10, 180),
          rx('chest-row', 2, 8, 12, 90),
          rx('cable-lateral-raise', 2, 12, 20, 60, 'optional', ['lateral-raise']),
          rx('barbell-curl', 2, 8, 12, 60, 'optional', ['dumbbell-curl']),
          rx('standing-calf', 2, 10, 15, 60, 'optional'),
        ],
      ),
      powerOption: true,
    },
    {
      ...day(
        2,
        'Aerobic conditioning + jump rope',
        'cardio',
        '45–55 min',
        'Build conversational aerobic capacity; add rope only as lower-leg tolerance allows.',
      ),
      cardio: { ...easy },
      tasks: [
        task('warmup', 'Dynamic warm-up — 5 minutes', 'warmup', 5),
        task('cardio', 'Easy continuous aerobic conditioning — 30–40 min · RPE 3–4', 'cardio', 30),
        task('rope', 'Basic two-foot jump rope', 'rope', 6.5, 'optional'),
        task('stretch', 'Static stretching — 5–8 minutes', 'mobility', 6, 'optional'),
      ],
    },
    day(
      3,
      'Athletic strength + hypertrophy',
      'strength',
      '60–75 min',
      'Athletic strength with optional work for lats, shoulders, chest, arms and legs.',
      [
        rx('split-squat', 2, 8, 10, 90),
        rx('lat-pulldown', 3, 6, 10, 120, 'mandatory', ['chin-up']),
        rx('flat-db-press', 3, 6, 10, 120, 'mandatory', ['dip']),
        rx('cable-row', 2, 8, 12, 90),
        rx('leg-curl', 2, 10, 15, 90),
        rx('rear-fly', 2, 12, 20, 60, 'optional', ['face-pull']),
        rx('cable-lateral-raise', 2, 12, 20, 60, 'optional'),
        rx('hammer-curl', 2, 10, 15, 60, 'optional'),
        rx('triceps', 2, 10, 15, 60, 'optional'),
        rx('tibialis', 2, 15, 25, 60, 'optional'),
      ],
    ),
    {
      ...day(
        4,
        'Mobility + recovery',
        'recovery',
        '15–25 min',
        'Restore comfortable movement in ankles, hips, upper back and shoulders.',
      ),
      tasks: [
        task('ankles', 'Knee-to-wall ankle mobility — 2 × 10/side', 'mobility', 3),
        task('hips', '90/90 hip switches — 2 × 8/side', 'mobility', 3),
        task('adductors', 'Adductor rock-backs — 2 × 10', 'mobility', 3),
        task('thoracic', 'Thoracic open-book rotations — 2 × 8/side', 'mobility', 3),
        task('wall', 'Wall slides — 2 × 10', 'mobility', 3),
        task('hip-stretch', 'Hip-flexor stretching', 'mobility', 2, 'optional'),
        task('calf-stretch', 'Calf and soleus stretching', 'mobility', 2, 'optional'),
        task('hamstring-stretch', 'Hamstring stretching', 'mobility', 2, 'optional'),
        task('upper-stretch', 'Chest and lat stretching', 'mobility', 2, 'optional'),
      ],
    },
    day(
      5,
      'Relative strength + muscular endurance',
      'strength',
      '60–70 min',
      'Repeatable strength, lower-body capacity and core stability. Keep push-ups 2–3 reps short of technical failure.',
      [
        rx('trap-deadlift', 3, 4, 6, 180),
        rx('chin-up', 3, 5, 10, 120, 'mandatory', ['assisted-chin-up']),
        rx('landmine', 3, 8, 12, 90),
        rx('reverse-lunge', 2, 8, 8, 90),
        rx('push-up', 2, 1, 30, 60, 'mandatory', [], 'submax'),
        rx('pallof', 2, 10, 12, 60),
        rx('farmer-carry', 3, 30, 40, 60, 'optional', [], 'seconds'),
        rx('soleus-raise', 2, 12, 20, 60, 'optional'),
        rx('band-external-rotation', 2, 12, 15, 45, 'optional'),
      ],
    ),
    {
      ...day(
        6,
        'Conditioning + jump rope',
        'cardio',
        '40–55 min',
        'Weeks 1–2: easy aerobic work. From week 3, controlled bike or rower intervals only if recovery permits.',
      ),
      cardio: { ...easy, activity: 'Cycling' },
      intervalPlan: { rounds: 6, workSeconds: 60, recoverySeconds: 120 },
      tasks: [
        task('warmup', 'Easy warm-up — 8 minutes', 'warmup', 8),
        task('cardio', 'Easy aerobic session — 30–40 min · RPE 3–4', 'cardio', 30),
        task('cooldown', 'Easy cooldown — 5 minutes', 'cooldown', 5),
        task('rope', 'Basic two-foot jump rope', 'rope', 6.5, 'optional'),
        task('mobility', 'Light mobility', 'mobility', 5, 'optional'),
      ],
    },
    {
      ...day(
        7,
        'Complete rest',
        'rest',
        'No target',
        'No essential training. Optional gentle mobility carries no compliance penalty.',
      ),
      tasks: [task('gentle', 'Optional gentle mobility', 'mobility', 5, 'optional')],
    },
  ];
  return {
    id: BOXING_PROGRAM,
    name: 'Project APEX: Boxing Readiness',
    block: 'General athletic preparation',
    revision: '1',
    freshHistory: true,
    weeks: 14,
    startDate: dateKey(),
    archived: false,
    days,
    readiness: { intervals: false, jumps: false },
    updatedAt: now(),
  };
}
export const boxingRules = [
  'Prepare for a professional boxing coach around February 2027. No unsupervised boxing technique, punching, shadowboxing, stance, guard or boxing footwork.',
  'Prioritize conditioning, repeated-effort recovery, relative strength, lower-leg durability and shoulder/upper-back endurance. Optional work supports physique and accessory development.',
  'Mandatory means priority, not exercising through pain, illness or concerning symptoms. Skip any item and record why. Optional work can be left out without failure.',
  'Progress repetitions before load. Keep compounds generally 1–3 RIR and avoid excessive failure volume. One weak workout does not establish a trend.',
  'Build easy aerobic duration gradually at conversational RPE 3–4; treadmill speed follows effort, not a compulsory 6 mph.',
  'After about two weeks, introduce the optional jumps or controlled intervals only when recovery and tolerance are good. Neither is enabled automatically.',
  'Progress rope only when calf and Achilles tolerance allows. Longer term: repeated 3-minute efforts with 1-minute recoveries. No maximum-effort sprints or automatic extra hard cardio.',
];
