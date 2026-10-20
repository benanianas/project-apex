import type { Exercise } from '../domain/model';
// Original vector movement schematics. Points are head, neck, hip, elbow, hand, knee, foot.
type Pose = [number, number][];
const poses: Record<string, Pose> = {
  'Vertical pull': [
    [105, 49],
    [105, 65],
    [105, 108],
    [77, 65],
    [62, 28],
    [88, 144],
    [104, 167],
  ],
  Press: [
    [96, 91],
    [109, 101],
    [151, 123],
    [108, 64],
    [102, 33],
    [159, 149],
    [181, 153],
  ],
  Dip: [
    [108, 57],
    [108, 73],
    [111, 114],
    [86, 96],
    [87, 116],
    [125, 145],
    [102, 164],
  ],
  Squat: [
    [111, 53],
    [111, 70],
    [95, 109],
    [135, 83],
    [141, 62],
    [132, 127],
    [113, 160],
  ],
  Hinge: [
    [123, 69],
    [113, 83],
    [77, 102],
    [121, 107],
    [127, 135],
    [87, 131],
    [101, 162],
  ],
  Row: [
    [131, 57],
    [122, 75],
    [92, 111],
    [148, 91],
    [117, 105],
    [87, 139],
    [102, 165],
  ],
  Raise: [
    [105, 42],
    [105, 59],
    [105, 111],
    [65, 66],
    [38, 54],
    [86, 141],
    [83, 165],
  ],
  Curl: [
    [105, 42],
    [105, 59],
    [105, 110],
    [79, 94],
    [69, 63],
    [89, 140],
    [85, 165],
  ],
  Calf: [
    [108, 40],
    [108, 57],
    [108, 105],
    [133, 84],
    [145, 67],
    [110, 133],
    [120, 155],
  ],
  Core: [
    [105, 46],
    [105, 63],
    [105, 112],
    [139, 82],
    [163, 82],
    [87, 142],
    [80, 165],
  ],
  Lunge: [
    [105, 43],
    [105, 60],
    [105, 108],
    [88, 88],
    [86, 117],
    [137, 116],
    [148, 164],
  ],
  'Leg curl': [
    [96, 56],
    [96, 74],
    [99, 111],
    [122, 94],
    [126, 112],
    [143, 110],
    [121, 148],
  ],
  Pressdown: [
    [105, 44],
    [105, 61],
    [105, 112],
    [126, 88],
    [134, 118],
    [88, 143],
    [84, 165],
  ],
  'Push-up': [
    [162, 72],
    [147, 85],
    [99, 97],
    [157, 117],
    [158, 150],
    [66, 124],
    [36, 148],
  ],
  Carry: [
    [105, 40],
    [105, 57],
    [105, 109],
    [75, 84],
    [74, 117],
    [85, 140],
    [76, 165],
  ],
  Rope: [
    [105, 38],
    [105, 55],
    [105, 108],
    [72, 86],
    [60, 98],
    [94, 137],
    [90, 158],
  ],
  Circle: [
    [106, 41],
    [106, 58],
    [106, 112],
    [69, 59],
    [36, 61],
    [89, 141],
    [83, 167],
  ],
  Hip: [
    [103, 58],
    [103, 74],
    [102, 116],
    [131, 97],
    [147, 123],
    [137, 138],
    [161, 128],
  ],
  Rotation: [
    [146, 102],
    [132, 108],
    [91, 120],
    [154, 73],
    [166, 44],
    [120, 144],
    [151, 144],
  ],
  Stretch: [
    [122, 54],
    [115, 71],
    [94, 105],
    [148, 72],
    [171, 61],
    [76, 135],
    [60, 166],
  ],
  Walk: [
    [109, 41],
    [109, 58],
    [105, 110],
    [84, 83],
    [74, 106],
    [132, 133],
    [148, 163],
  ],
  'Warm-up': [
    [105, 42],
    [105, 59],
    [105, 110],
    [76, 81],
    [68, 110],
    [88, 140],
    [83, 165],
  ],
};
export default function ExerciseDiagram({
  exercise,
  small = false,
}: {
  exercise: Exercise;
  small?: boolean;
}) {
  let pose = poses[exercise.diagram] ?? poses['Warm-up'];
  if (exercise.id === 'ab-wheel')
    pose = [
      [147, 85],
      [130, 95],
      [91, 108],
      [158, 112],
      [177, 143],
      [77, 145],
      [44, 145],
    ];
  if (exercise.id === 'rear-fly')
    pose = [
      [124, 60],
      [112, 78],
      [86, 107],
      [147, 76],
      [174, 55],
      [91, 137],
      [103, 164],
    ];
  if (exercise.id === 'wall-slide')
    pose = [
      [104, 50],
      [104, 67],
      [104, 111],
      [73, 51],
      [71, 24],
      [91, 141],
      [85, 166],
    ];
  if (exercise.id === 'figure-four')
    pose = [
      [60, 136],
      [75, 136],
      [116, 136],
      [91, 118],
      [122, 112],
      [137, 100],
      [111, 87],
    ];
  const [head, neck, hip, elbow, hand, knee, foot] = pose;
  const points = (ps: Pose) => ps.map((p) => p.join(',')).join(' ');
  const bilateral = ![
    'Row',
    'Lunge',
    'Stretch',
    'Rotation',
    'Hip',
    'Press',
    'Push-up',
    'Hinge',
    'Squat',
  ].includes(exercise.diagram);
  const mirror = (p: number[]): [number, number] => [210 - p[0], p[1]];
  return (
    <svg
      className={`exercise-diagram ${small ? 'thumbnail' : ''}`}
      viewBox="0 0 210 190"
      role="img"
      aria-label={`${exercise.name}: ${exercise.steps[1] ?? exercise.steps[0]}`}
    >
      <path d="M24 169H186" stroke="currentColor" opacity=".15" />
      <path d="M42 20V170M168 20V170" stroke="currentColor" opacity=".04" strokeDasharray="3 5" />
      {exercise.diagram === 'Vertical pull' && (
        <path
          d="M40 27H170M45 27V168M165 27V168"
          stroke="currentColor"
          strokeWidth="3"
          opacity=".35"
        />
      )}
      {exercise.diagram === 'Press' && (
        <path
          d="M63 91 157 139H179M81 102V167M154 141V167"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          opacity=".3"
        />
      )}
      {exercise.diagram === 'Dip' && (
        <path
          d="M60 117H144M70 117V169M143 117V169"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          opacity=".3"
        />
      )}
      {exercise.diagram === 'Rope' && (
        <path
          d="M60 98C8 194 202 194 150 98"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="3 4"
        />
      )}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={head[0]} cy={head[1]} r="10" strokeWidth="3.5" />
        <polyline points={points([neck, hip, knee, foot])} />
        <polyline points={points([neck, elbow, hand])} />
        <polyline
          points={points(
            bilateral
              ? [neck, mirror(elbow), mirror(hand)]
              : [hip, [hip[0] - 20, hip[1] + 26], [hip[0] - 34, 165]],
          )}
          opacity=".45"
        />
        {bilateral && <polyline points={points([hip, mirror(knee), mirror(foot)])} opacity=".45" />}
      </g>
      {['resistance', 'carry', 'weighted-bodyweight'].includes(exercise.type) && (
        <g stroke="var(--accent)" strokeWidth="4" strokeLinecap="round">
          <path d={`M${hand[0] - 7} ${hand[1]}h14m-14 -5v10m14 -10v10`} />
          {exercise.loadMode === 'per-hand' && bilateral && (
            <path d={`M${210 - hand[0] - 7} ${hand[1]}h14m-14 -5v10m14 -10v10`} />
          )}
        </g>
      )}
      <path
        d={
          ['Calf', 'Vertical pull', 'Squat', 'Lunge'].includes(exercise.diagram)
            ? 'M177 126V86m-5 7 5-7 5 7'
            : 'M33 105Q19 75 40 53m-8 1 8-1-1 8'
        }
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {!small && (
        <text
          x="105"
          y="186"
          textAnchor="middle"
          fontSize="8"
          letterSpacing="1.5"
          fill="currentColor"
          opacity=".5"
        >
          CONTROLLED MOVEMENT
        </text>
      )}
    </svg>
  );
}
