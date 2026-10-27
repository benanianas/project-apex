# Validation record

Validated on 2026-10-27 using Node 24.20.0 on macOS.

- **64 Vitest tests passed:** original calculations, storage and cancellation coverage plus Boxing Readiness prescriptions, phase gating, mandatory/optional completion, actual interval/rope targets, stable-identity previous sets, machine/load semantics, fresh comparison scope, one-time installation, unchanged historical records, snapshot isolation, and v1/v2/v3 backup compatibility. Interval logs, task skips, priorities, equipment labels and recovery round-trip through export/restore.
- **40 browser tests passed** in Chromium and WebKit using Playwright's iPhone 17 Pro profile. Fourteen new checks cover the default program, visible Start action, required/optional counts, reasoned skips and partial history, essential completion with accessories untouched, per-hand pounds and unknown RIR, substitutions/equipment references, interval phase approval and actual logs, priority-edit snapshot isolation, and single-exercise skips.
- The original 26 browser checks continue to cover logging, autosave/reload, undo, timers, charts, activity drafts and history edits, custom exercises, unit conversion, program editing, JSON download/merge/replace, CSV, invalid imports, offline guides/logging, PWA assets, shared exercise logging, cancellation and linked-record cleanup. Two of these simulate full-screen safe-area layout at 402 × 874.
- TypeScript, ESLint, Prettier and the Vite production build passed. Service-worker precaching includes lazy screens, charts and local guides.
- WebKit screenshots inspected for Today, previous sets/current entry, skip sheet, exercise log, conditioning, rope form and mobility. An additional UI-driven session was finished and its actual saved set appeared in the next workout's reference. No browser errors or horizontal overflow appeared at 402 or 320 pixels. Today spacing was reduced so Start workout clears the bottom tabs without scrolling.

Tests use disposable browser profiles and fictional fixtures. No personal training data is seeded, imported, corrected or cleared by this update. Screenshots and traces are local ignored artifacts.

Deployment target: [GitHub Pages](https://benanianas.github.io/project-apex/). Manifest ID, scope and start URL use `/project-apex/`; publishing includes only the static build. Public smoke tests run after deployment in isolated profiles, including offline behavior and the new program flows.

The database moves to Dexie v3 without rewriting old workouts. Backup v3 retains the new metadata and accepts existing v1/v2 files. Existing users receive the fresh Boxing Readiness program once; subsequent program choices are respected. Old histories remain available but do not prefill the new block's workout references.

A physical iPhone was not available. Home Screen installation, actual keyboard and safe-area behavior, Share Sheet destinations, background suspension and storage eviction still need the checks in [IOS-QA.md](IOS-QA.md). No test can guarantee that iOS will retain local data forever. The app continues to use native keyboard controls with no duplicate Done/Next toolbar.
