# PROJECT APEX

An installable, offline-first personal strength and conditioning tracker. React + TypeScript + Vite, Tailwind/CSS, Dexie IndexedDB, Recharts, Lucide, Zod, and Workbox through vite-plugin-pwa. No login, backend, cloud synchronization, analytics SDK, API key, or paid service is needed.

APEX includes the original seven-day foundation block: three full-body sessions (23/24/24 working sets), two conditioning sessions, active recovery, and complete rest. Days are numbered and freely selectable. Reporting weeks begin Wednesday by default.

Designed around iPhone 17 Pro: a single-column app shell, safe-area-aware bottom tabs, focused one-exercise workout logging, bottom sheets, and a keyboard accessory. Desktop browsers show the same compact app.

## Run locally

Requires Node 22.12+ (Node 24 used for validation) and npm. On the configured SSD development machine:

```sh
cd /Users/agent/agentSSD/projects/ApexV1.0
./scripts/bootstrap-ssd.sh
npm run dev
```

The bootstrap keeps dependencies and Playwright browsers under `/Users/agent/agentSSD/dev`, following this workspace's installation policy. On another machine, a conventional `npm ci` is sufficient. The lockfile pins compatible dependency versions. Do not copy `node_modules` or the SSD symlink into deployment artifacts.

```sh
npm run test          # Calculation and IndexedDB integration tests
npm run typecheck
npm run lint
npm run format:check
npm run build         # dist/ static application; includes PWA precache
npm run preview      # localhost:4173; production service worker enabled
PLAYWRIGHT_BROWSERS_PATH=/Users/agent/agentSSD/dev/cache/playwright npm run test:e2e
```

The dev server intentionally does not register a service worker. Use the production preview for offline testing. Playwright tests use disposable browser profiles and fictional fixtures; no sample training is seeded into the application.

## Using APEX

- **Today:** select any day, inspect the prescription, start or resume. Rest has no mandatory log. Recovery uses a mobility checklist.
- **Workout:** completed sets and edits save immediately to IndexedDB. Drafts survive reloads. Mark each actual set complete; blank values are distinct from zero. Use `W` to flag warm-ups. Set options contain RPE, notes, and removal. Carry rows support time and distance. Timer state persists and uses a deadline timestamp.
- **Progress:** inspect weekly sets, resistance volume, primary-muscle sets, cardio by modality, rope development, consistency, and saved history. Edit sessions or activities from History. Deleting a workout also deletes linked cardio/rope records after confirmation.
- **Exercises:** opening a movement shows **Log sets → Your progress → Exercise info**. Log directly into its active workout, or complete a separate single-exercise session. Visiting a page alone creates no saved record. Exercise info opens the offline guide, original vector schematic, muscles, alternatives and clearly labeled online video search. No external video/media loads until tapped.
- **Program:** change prescriptions, substitute/reorder movements, create/duplicate/reorder days and programs, create future blocks, assign optional weekdays, or archive programs. A restored original template is a new copy. History always keeps its original movement and prescription snapshots. Custom logging-convention changes create a new exercise identity.
- **Settings:** units, Wednesday default week boundary, rest-timer behavior, rope reference stage, available load increments, compact display, backups and storage information. Program start dates are edited in Program.

The logger's advice is optional. It never changes loads or advances rope stages automatically. Missing effort is unknown, not failure. Reassessment appears when a block has elapsed; Progress includes block measures throughout.

## Your data and backups

All personal records live in the browser's **IndexedDB database `project-apex`**, scoped to its web origin/browser profile. Cache Storage holds application assets separately. There is no upload of workout data. A static hosting provider may still keep its normal web access/security logs.

**Browser storage is not a permanent backup.** Safari/iOS may evict it. Clearing website data, losing a device, changing browsers, or moving to another origin can make records unavailable. Persistence is requested when supported; the browser may refuse. Do not use private browsing for long-term records. Multiple installations/browser contexts may have separate storage. Use one installation as your source of truth; cross-tab concurrent editing is not intended.

In Settings → Backup & Restore:

1. **Export complete backup** downloads timestamped JSON with all logs, custom exercises, programs, preferences, timers and in-progress activity drafts. A Share action is offered when the browser supports it. Verify the file in Files/Downloads; an export timestamp cannot prove it was kept.
2. Choose a JSON file to see its record counts and format version.
3. **Merge** imports new IDs and keeps existing records/settings. Conflicting matching IDs are skipped rather than silently overwritten. The success message reports added and skipped counts.
4. **Restore / Replace** uses the backup as the complete local state, only after typing `REPLACE`. Back up the current state first. Validation occurs before a single IndexedDB transaction; a failed write rolls back the entire import.

Backups above 20 MB, unsupported versions, duplicate IDs, dangling required references, malformed records and invalid values are rejected. The format supports a defined v1→v2 migration; it does not promise support for arbitrary foreign fitness files. CSV exports for sets, workouts, cardio and rope are for analysis, not full restoration, and use normalized units with escaped spreadsheet-safe cells.

## Deployment

**Chosen hosting: GitHub Pages.** This environment has authenticated GitHub access, making it the simplest available free static deployment. A new public source repository is suitable for the free Pages tier; personal data is never in the repository. Cloudflare Pages also supports this build and is documented below. Neither option needs a paid domain or a backend.

GitHub configuration:

- Source repository: `main`; static deployment branch: `gh-pages`, folder `/`.
- Build: `BASE_PATH=/project-apex/ npm run build` for a repository named `project-apex`.
- Output: `dist`; publish only those files, including `.nojekyll`.
- Hash routing (`#today`, `#exercise/...`) avoids subpath/404 routing problems. Manifest start URL, scope, asset URLs and service worker scope follow `BASE_PATH`.
- After source changes pass checks, commit/push main and run `./scripts/deploy-pages.sh`. It publishes a normal new commit to `gh-pages`; it does not force-push or touch other branches. Set Pages to deploy from that branch in repository Settings → Pages if not already configured.
- The included GitHub Actions workflow validates source. Browser binaries installed by CI are ephemeral runner dependencies, separate from the local SSD setup.

Cloudflare Pages alternative:

1. Import this repository in Workers & Pages → Create → Pages → Import an existing Git repository.
2. Production branch `main`, build command `npm run build`, output directory `dist`, Node version `24`; leave `BASE_PATH=/`.
3. Deploy and use the provided HTTPS `*.pages.dev` URL. There are no functions, databases or credentials in this application.
4. Export on the previous origin and restore on the new one. Browser data does not transfer with hosting.

Official references: [GitHub Pages availability and URLs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Cloudflare Pages React settings](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/), [PWA update prompting](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html).

## Install on iPhone and use offline

Open the deployed HTTPS URL in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** if offered, and tap Add. Launch the icon online once and wait for **Offline ready**. Guides, illustrations, charts, logging, backup export and restore are then available offline. Video searches need connectivity. Home Screen installation requires a real HTTPS deployment; an ordinary LAN HTTP address is not equivalent to localhost.

## Updates and limitations

New service workers wait for user-directed refresh. No update deletes IndexedDB. Save edits before applying an update in Settings. If caching fails, reconnect and reload; don't clear website storage as a troubleshooting shortcut. Database migrations are explicit and non-destructive. Before changing the model, retain historical schema compatibility and add a migration test.

Charts are empty until you record real activity. Estimated 1RM is labeled and limited to eligible resistance sets. Machine loads, lever systems and different variants are not interchangeable. Schematics are original simplified guides, not motion-capture demonstrations; video links are searches, not fabricated verified videos. The product is for general training logging and does not provide medical assessment or boxing technique.

Automated Chromium and WebKit mobile emulation is covered by Playwright. It cannot replace a physical iPhone check of Home Screen installation, iOS storage eviction, Share Sheet destinations, virtual-keyboard behavior, and background suspension. See [iOS QA](docs/IOS-QA.md), [data and calculations](docs/DATA-MODEL.md), [asset attribution](docs/ATTRIBUTION.md), and [validation results](docs/VALIDATION.md).
