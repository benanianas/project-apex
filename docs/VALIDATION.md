# Validation record

Validated on 2026-10-20 using Node 24.20.0 on macOS.

- **50 Vitest tests passed**: exact seven-day seed and guides; resistance, paired dumbbell, unilateral, warm-up and special-type metrics; conservative progression; speed/distance conversions; Wednesday weekly aggregation; completed-only chart data; individual exercise session preparation; IndexedDB draft/reload/edit/snapshots; migration; transactional JSON merge/replace and invalid import rejection; CSV handling.
- **18 browser workflow tests passed** using Chromium and WebKit with Playwright's iPhone 17 Pro profile. Covered navigation, mobility, set logging, reload, undo, timers, finishing, real charts, cardio/rope draft forms and saved edits, custom exercises, program snapshot preservation, JSON download/merge/replace, CSV, invalid JSON, offline lazy guides and logging, manifest and service worker, shared exercise/workout logging, separate guide route and individual exercise sessions.
- **2 additional full-screen layout tests passed** at 402 × 874 with representative injected safe areas, checking reachable bottom navigation/workout actions and dialog controls. These are layout simulations, not real Home Screen or keyboard tests.
- TypeScript, ESLint, Prettier, and Vite production build passed. The production service worker precaches the shell, local illustrations/icons, lazy screens and charts.
- Rendered phone views inspected: Today, focused workout, exercise logging, separate guide, and grouped Settings. Desktop and 320-pixel width overflow checks also passed.

**Deployment:** [GitHub Pages](https://benanianas.github.io/project-apex/) returned HTTPS 200 and its Pages build/deployment completed successfully. The manifest start URL, ID and scope are `/project-apex/`. Six additional checks against the public URL passed in Chromium and WebKit: offline reload/logging/guides/export, shared exercise logging and separate guide navigation, and full-screen layout.

Tests use isolated browser profiles and fictional fixtures; the shipped application starts with no personal history. Screenshots and Playwright traces are local ignored artifacts, not deployed data.

A physical iPhone was not available. Home Screen installation, actual iOS safe-area values, keyboard and Share Sheet behavior, background suspension, and storage eviction require the checks in [IOS-QA.md](IOS-QA.md). No test can guarantee that iOS will retain local data forever.
