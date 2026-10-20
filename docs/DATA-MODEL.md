# Data model and calculation contracts

Database: `project-apex`, Dexie schema v2. Backup format: `project-apex`, version 2, ISO export timestamp. IDs are stable slugs for original definitions and UUIDs for personal entities. Dates use local `YYYY-MM-DD`; event timestamps use UTC ISO 8601. Week arithmetic uses local noon and calendar dates, avoiding UTC-date and daylight-saving boundary shifts.

| Table     | Contents                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| exercises | Definitions: primary/secondary muscles, equipment, guides, diagrams, movement type, load convention, per-side behavior, alternatives, archive flag |
| programs  | Templates with block name, duration, start date and ordered training days; independent exercise prescriptions per day                              |
| sessions  | Draft/completed workouts, notes, checklist, date and full exercise/prescription/set snapshots                                                      |
| cardio    | Modality, minutes, normalized speed/distance, incline, RPE, heart rate, notes and completion; optional parent workout ID                           |
| rope      | Rounds, work/rest interval, optional elapsed time, effort, tolerance, completion and optional parent workout ID                                    |
| settings  | Display units, week boundary, active program/day, rest settings, rope stage, load increment, export metadata and reminder preference               |
| timers    | Rest duration, paused remaining seconds, and absolute finish timestamp                                                                             |
| drafts    | Autosaved unfinished cardio/rope form values, including the units in which they were entered                                                       |

v1→v2 adds the draft table and defaults exercise archive state without dropping any record. The backup v1→v2 migration adds empty draft/timer arrays where absent. Import uses runtime Zod validation, semantic set validation, unique IDs and required reference checks before its transaction. Import failures never trigger database deletion. Merge keeps current matching IDs and settings; replace clears and restores tables within one transaction.

## Resistance semantics

Internal load is kilograms; distance is kilometers for cardio and meters for movement distances; speed is km/h; times are seconds or minutes explicitly named by field. Conversion constants are `1 lb = 1 / 2.2046226218487757 kg` and `1 mile = 1.609344 km`.

For `resistance`, completed working-set volume is:

`loadKg × implement count × entered repetitions × side count`

- Total-load/barbell/machine: implement count 1.
- Per-hand dumbbell pair: implement count 2.
- Bilateral repetitions: side count 1.
- Equal repetitions per side, with one row covering both sides: side count 2.
- Example: Bulgarian split squat with 10 kg in each hand, 8 reps per leg = 10 × 2 × 8 × 2 = 320 kg·reps.
- One-arm row with a single 20 kg dumbbell, 10 reps each side = 20 × 1 × 10 × 2 = 400 kg·reps. Its convention is **total load**, not a pair of dumbbells.
- Warm-up and incomplete sets contribute zero working volume. Blank and zero loads are distinct.
- `bodyweight`, `assisted`, `weighted-bodyweight`, `timed`, `carry` and `distance` return **null** for conventional volume. Their reps, assistance/added load, time or distance remain visible. No bodyweight measurement is required or fabricated.
- Farmer carries record per-hand external load plus seconds and/or meters. No fake reps or load×distance tonnage is included in lifting volume.
- Landmine entries consistently record plates added to the lever, not a derived force at the hand. Compare the same setup only.

Each completed set is assigned to exactly one primary muscle for approximate weekly hard-set counts; secondary involvement is descriptive and never added as another independent set. Hard-set counts cannot infer technique or sufficient effort if unlogged. Overall volume reflects program composition; individual movement comparisons provide stronger evidence than summing unrelated variants.

Eligible estimated strength uses Epley (`total load × (1 + reps / 30)`), only completed working sets with 1–10 reps on bilateral, non-isolation resistance movements. It is an estimate, never a tested maximum or a bodyweight/carry metric.

## Progression and records

Double progression requires exactly the prescribed number of completed working sets at a consistent load and the top of the rep range. RIR or RPE must establish appropriate effort for every set: heavy compounds ≥2 RIR / ≤8 RPE; compounds ≥1 / ≤9; isolation ≥0 / ≤10. Conflicting effort fields fail the conservative check. Missing RIR/RPE remains unknown. If eligible, the next suggestion rounds upward to an achievable increment; accepting and entering it is always the user's decision. Incomplete, extra, mixed-load, submax, carry and other incompatible sets do not receive a confident load-increase suggestion.

Repeated under-range performance is considered only with a matching exercise identity, prescription and load in the preceding session. Histories and charts are sorted by recorded date and timestamp. Program substitutions have distinct identities. Changing a custom exercise's type, load mode or side convention creates a new identity; previous snapshots remain intact. Assistance trends show the lowest completed working-set assistance per session, with lower being less support.

## Conditioning and consistency

Cardio distance = average km/h × minutes / 60, only when speed is known and positive; manually supplied distance takes precedence. Pace = minutes / positive distance. Speed and pace trends are filtered by exact modality. Optional comparable-effort filtering requires known RPE within 1 and duration within 5 minutes of the latest session. Missing measurements are not imputed. Minutes aggregate across aerobic modalities; intensity is not treated as universally better.

Rope active time = completed rounds × work seconds; rest is excluded. Optional elapsed time cannot be less than active work. Reference stages never auto-advance. A latest poor tolerance assessment blocks advancing the reference until a good recovered session is logged. The final 3×180-second benchmark is distinct from merely accumulating 9 minutes across short rounds.

The default reporting week is Wednesday 00:00 through Tuesday 23:59 local time; settings can change the boundary. Consistency compares strength/cardio session counts with current program targets (initially 3 + 2), caps each modality's contribution at its target and does not penalize rest/recovery days or unopened calendar days. Linked cardio records and their completed parent session count as one conditioning session. Distinct unlinked activity records count separately. Multiple workouts on a date are supported; active dates are counted uniquely. Recovery completion is reported separately.

## Integrity and recovery

Workouts are saved on every valid field change via a serialized promise queue; completed sets are checked semantically before persistence. Save errors keep the current UI draft available with an explicit retry action. Cardio/rope fields also autosave to the draft table before submission. Finishing waits for pending writes. Browser termination before a transaction commits can still lose the last keystroke; no browser app can guarantee a write after abrupt termination. Keep JSON backups.

The app is designed for one active editor/browser context. Concurrent editing in multiple tabs or restored installations is not synchronized. IndexedDB and service-worker caches are independent. External videos are plain safe links and no runtime third-party content is requested until selected.
