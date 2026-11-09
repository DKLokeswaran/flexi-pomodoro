# Repository Structure

Annotated layout of the source tree (binary alert WAVs listed by pattern only).

```
flexi-pomodoro/
├── package.json                 # Workspace root: scripts, engines node>=20, version 0.0.3-alpha.0
├── package-lock.json
├── AGENTS.md                    # Agent rules: read apps/web/DESIGN.md before frontend work
├── Dockerfile                   # Multi-stage: deps → build → runtime as USER node (port 3847)
├── docker-compose.yml           # Single service; DATA_DIR=/data; FPMD_DATA_DIR bind or named volume
├── .dockerignore
├── .gitignore
├── .prettierrc
├── .prettierignore              # Also skips vendored .agents skills
├── .git-blame-ignore-revs        # Skip the Prettier format commit in git blame
├── .agents/skills/shadcn/       # Vendored shadcn skill (linked from .claude/skills)
├── .cursor/plans/
│   ├── m1_timer_core.plan.md    # M1 implementation plan notes
│   ├── m2_pause_modules.plan.md # M2 pause plugin plan notes
│   ├── m2.5-ack-stats.plan.md   # M2.5 short-rest ack + live stats plan
│   └── m3_persistence_resume.plan.md  # M3 SQLite persistence + resume plan
├── docs/
│   └── product/                 # Product docs (PRD, roadmap) — not generated tech reference
├── packages/
│   └── shared/                  # @flexi-pomodoro/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # Schemas, SESSION_API, phase/session types
│           ├── bounds.ts        # Production SETTINGS_BOUNDS
│           ├── liveStatsProgress.ts  # pausedSecAt / plannedWorkSecAt
│           └── debug/
│               ├── catalog.ts   # DEBUG_SERVER_FEATURES + parseDebugFlags
│               ├── types.ts
│               ├── getSettingsBounds.ts
│               └── features/shortDurations.ts
├── apps/
│   ├── server/                  # @flexi-pomodoro/server
│   │   ├── package.json
│   │   ├── tsconfig.json        # excludes src/tests/**
│   │   └── src/
│   │       ├── index.ts         # listen entry
│   │       ├── app.ts           # composition root (openDatabase + settings/session hydrate + recovery)
│   │       ├── scheduler.ts
│   │       ├── db/
│   │       │   ├── index.ts         # openDatabase, createStores, AppStores
│   │       │   ├── knex.ts          # resolveDataDir, createKnex, migrateLatest
│   │       │   ├── migrations/
│   │       │   │   ├── 20260909134105_initial_schema.ts
│   │       │   │   └── 20261109143000_settings_timezone.ts  # settings.timezone (IANA)
│   │       │   └── stores/
│   │       │       ├── settingsStore.ts  # singleton settings load/save/seed
│   │       │       ├── sessionStore.ts   # sessions + session_runtime write-through
│   │       │       └── phasesStore.ts    # phase/segment + pause_slices write-through
│   │       ├── pause/
│   │       │   ├── index.ts         # Barrel: registry, soft strategy, types
│   │       │   ├── types.ts         # WorkPauseStrategy plugin contract
│   │       │   ├── registry.ts      # PauseStrategyRegistry + defaultPauseRegistry
│   │       │   ├── softPause.ts     # Soft pause plugin (FR-PAUSE-S6/S7)
│   │       │   └── hardPause.ts     # Hard pause plugin (FR-PAUSE-H2)
│   │       ├── routes/
│   │       │   ├── index.ts
│   │       │   ├── health.routes.ts
│   │       │   ├── settings.routes.ts
│   │       │   └── session.routes.ts
│   │       ├── services/
│   │       │   ├── settings.service.ts
│   │       │   └── session.service.ts
│   │       ├── utils/
│   │       │   ├── errorReply.ts         # HTTP mapping for SettingsError / SessionError
│   │       │   ├── settingsValidation.ts # SettingsPatchSchema, parse/merge start+settings bodies
│   │       │   ├── iso.ts                # msToIso / parseIso helpers
│   │       │   └── asyncMutex.ts         # runExclusive / tryRunExclusive for session ticks
│   │       └── tests/
│   │           ├── db/
│   │           │   ├── settingsStore.test.ts
│   │           │   ├── sessionStore.test.ts
│   │           │   └── phasesStore.test.ts
│   │           ├── helpers/
│   │           │   ├── mockSettingsStore.ts
│   │           │   ├── mockSessionStores.ts  # in-memory SessionStore + PhasesStore
│   │           │   └── tempDatabase.ts       # openTempDatabase (migrated temp SQLite)
│   │           ├── pause/
│   │           │   ├── softPause.test.ts
│   │           │   └── hardPause.test.ts
│   │           ├── services/
│   │           │   ├── settings.service.test.ts
│   │           │   ├── settings.service.persist.test.ts
│   │           │   ├── session.service.test.ts
│   │           │   ├── session.attribution.test.ts
│   │           │   ├── session.recovery.test.ts
│   │           │   └── session.recovery.matrix.test.ts
│   │           └── utils/
│   │               └── asyncMutex.test.ts
│   └── web/                     # @flexi-pomodoro/web
│       ├── index.html           # favicon links; font CSS via fontsource imports in styles.css
│       ├── package.json
│       ├── components.json      # shadcn/ui (base-nova) config
│       ├── DESIGN.md            # Quiet Dark flavor tokens + prose (authoritative for frontend)
│       ├── vite.config.ts       # Tailwind plugin; @ → src; proxy /api → :3847; __APP_VERSION__
│       ├── tsconfig.json        # excludes src/tests/**; paths @/*
│       ├── tsconfig.node.json
│       ├── public/
│       │   ├── alerts/          # placeholder-*.wav (one per AlertId; 8 files)
│       │   ├── logo.svg         # app logo and favicon
│       │   ├── favicon-32.png   # raster favicon fallback
│       │   └── apple-touch-icon.png
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles.css       # Tailwind + Quiet Dark theme tokens + type utilities
│           ├── vite-env.d.ts
│           ├── lib/utils.ts     # cn() re-export for shadcn class merging
│           ├── components/      # tabs + Logo + NumberField + Stubs
│           ├── components/ui/   # shadcn primitives in use (button, card, field, …)
│           ├── components/timer/  # IdleStartForm, ActiveTimer, TimerDial, timerDisplay
│           ├── components/about/
│           ├── constants/
│           ├── hooks/           # useNow, useSessionStream, useSeedTimezone, SSE transport
│           ├── browserFlags/    # createFlagCatalog, createFlagStore, debug/, ui/ (classicTimer, hideContinueButton)
│           ├── providers/       # Toast
│           ├── queries/         # fetch helpers + React Query hooks
│           ├── utils/           # time, liveStats, dialProgress, phaseClock, projections, alerts, ianaTimeZones, seedTimezone, …
│           └── tests/
│               └── utils/
│                   ├── sessionProjection.test.ts
│                   ├── activeSessionProjection.test.ts
│                   ├── dialProgress.test.ts
│                   ├── liveStats.test.ts
│                   └── seedTimezone.test.ts
```

## Top-level folder roles

| Path | Role |
|------|------|
| `apps/server` | HTTP/SSE API, session engine, SQLite settings + session write-through + boot resume, optional static host |
| `apps/web` | React UI (Quiet Dark / shadcn + timer dial) |
| `packages/shared` | Cross-cutting domain contract |
| `docs/product` | Product PRD and roadmap |
| `AGENTS.md` / `apps/web/DESIGN.md` | Frontend design authority for agents and humans |
| `.agents/skills` | Vendored agent skills (e.g. shadcn); ignored by Prettier |
| `.cursor/plans` | Internal planning artifacts (M1–M3.5) |

## Language composition (committed files)

Counts exclude `node_modules`, build artifacts, and vendored `.agents` skill trees.

| Extension | Count |
|-----------|------:|
| `.ts` | 103 |
| `.tsx` | 28 |
| `.css` | 1 |
| `.json` | 23 |
| `.wav` | 8 |
| `.md` | 23 |
| Other (yml, html, Docker, ignore, svg/png) | — |

## Where to add new code

| Change | Location |
|--------|----------|
| New REST endpoint | `apps/server/src/routes/<domain>.routes.ts`; register in `routes/index.ts`; add path to `SESSION_API` in shared if shared |
| HTTP error mapping | `apps/server/src/utils/errorReply.ts` (shared by session and settings routes) |
| Session transition / alert | `SessionService` + shared `AlertIdSchema` / phase types; extend tests under `apps/server/src/tests/services/` |
| Work-pause strategy | New plugin under `apps/server/src/pause/`; register in `defaultPauseRegistry()`; add isolated tests under `apps/server/src/tests/pause/` |
| Settings field | Shared Zod schemas + `DEFAULT_SETTINGS` + server `settingsValidation` / `SettingsService` + `SettingsStore` + Settings UI |
| Settings / start body parse | `apps/server/src/utils/settingsValidation.ts` |
| SQLite table / migration | `apps/server/src/db/migrations/`; store methods under `db/stores/` |
| Web projection / liveStats unit test | `apps/web/src/tests/utils/<module>.test.ts` |
| Debug feature (server bounds) | `packages/shared/src/debug/features/<id>.ts`; register in `DEBUG_SERVER_FEATURES`; add web labels in `browserFlags/debug/features/` |
| Browser UI preference | New feature under `browserFlags/ui/features/`; register in `browserFlags/ui/catalog.ts` |
| UI tab / panel | `apps/web/src/components/`; wire in `App.tsx` + `Nav.tsx` |
| API client call | `apps/web/src/queries/<domain>.api.ts` + hook in `useSessionApi.ts` / dedicated query hook |
| Styling / new UI primitive | Read `DESIGN.md` first; Tailwind classes on components; add shadcn pieces under `components/ui/` via the project `components.json`; theme tokens in `styles.css` |

## Test location convention

Mirrored `src/tests/` trees (not colocated): server `services/` + `pause/` + `utils/` + `db/` + `helpers/`; web `utils/`. Each package runs its own tests; packages do not import each other's application source for tests.

## Config & build artifacts (ignored / not committed)

`node_modules/`, `dist/`, `coverage/`, `.env*`, `data/`, `.archify/` — see `.gitignore`. Docker ignores `**/node_modules`, `**/dist`, `.git`, `*.md`, `.cursor`.
