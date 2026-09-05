# Repository Structure

Annotated layout of the source tree (binary alert WAVs listed by pattern only).

```
flexi-pomodoro/
├── package.json                 # Workspace root: scripts, engines node>=20, version 0.0.1-alpha.4
├── package-lock.json
├── Dockerfile                   # Multi-stage: deps → build → runtime (port 3847)
├── docker-compose.yml           # Single service + /data volume stub
├── .dockerignore
├── .gitignore
├── .prettierrc
├── .prettierignore
├── .git-blame-ignore-revs        # Skip the Prettier format commit in git blame
├── .cursor/plans/
│   ├── m1_timer_core.plan.md    # M1 implementation plan notes
│   ├── m2_pause_modules.plan.md # M2 pause plugin plan notes
│   └── m2.5-ack-stats.plan.md   # M2.5 short-rest ack + live stats plan
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
│   │       ├── app.ts           # composition root
│   │       ├── scheduler.ts
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
│   │       │   └── iso.ts                # msToIso / parseIso helpers
│   │       └── tests/
│   │           ├── pause/
│   │           │   ├── softPause.test.ts
│   │           │   └── hardPause.test.ts
│   │           └── services/
│   │               ├── settings.service.test.ts
│   │               └── session.service.test.ts
│   └── web/                     # @flexi-pomodoro/web
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts       # proxy /api → :3847; __APP_VERSION__
│       ├── tsconfig.json        # excludes src/tests/**
│       ├── tsconfig.node.json
│       ├── public/alerts/       # placeholder-*.wav (7 files)
│       └── src/
│           ├── main.tsx
│           ├── App.tsx / App.module.css
│           ├── styles.css       # global tokens + shared utility classes
│           ├── vite-env.d.ts
│           ├── components/      # tabs + shared fields
│           ├── components/timer/
│           ├── components/about/
│           ├── constants/
│           ├── hooks/           # useNow, useSessionStream, SSE transport
│           ├── browserFlags/    # createFlagCatalog, createFlagStore, debug/, ui/
│           ├── providers/       # Toast
│           ├── queries/         # fetch helpers + React Query hooks
│           ├── utils/           # time, liveStats, sessionProjection, activeSessionProjection, fetchJson, alerts, errorMessage
│           └── tests/
│               └── utils/
│                   ├── sessionProjection.test.ts
│                   ├── activeSessionProjection.test.ts
│                   └── liveStats.test.ts
```

## Top-level folder roles

| Path | Role |
|------|------|
| `apps/server` | HTTP/SSE API, session engine, optional static host |
| `apps/web` | React UI |
| `packages/shared` | Cross-cutting domain contract |
| `docs/product` | Product PRD and roadmap |
| `.cursor/plans` | Internal planning artifacts (M1 timer core, M2 pause modules) |

## Language composition (committed files)

| Extension | Count |
|-----------|------:|
| `.ts` | 42 |
| `.tsx` | 17 |
| `.css` | 11 |
| `.json` | 9 |
| `.wav` | 7 |
| `.md` | 3 |
| Other (yml, html, Docker, ignore) | 5 |

## Where to add new code

| Change | Location |
|--------|----------|
| New REST endpoint | `apps/server/src/routes/<domain>.routes.ts`; register in `routes/index.ts`; add path to `SESSION_API` in shared if shared |
| HTTP error mapping | `apps/server/src/utils/errorReply.ts` (shared by session and settings routes) |
| Session transition / alert | `SessionService` + shared `AlertIdSchema` / phase types; extend tests under `apps/server/src/tests/services/` |
| Work-pause strategy | New plugin under `apps/server/src/pause/`; register in `defaultPauseRegistry()`; add isolated tests under `apps/server/src/tests/pause/` |
| Settings field | Shared Zod schemas + `DEFAULT_SETTINGS` + server `settingsValidation` / `SettingsService` + Settings UI |
| Settings / start body parse | `apps/server/src/utils/settingsValidation.ts` |
| Web projection / liveStats unit test | `apps/web/src/tests/utils/<module>.test.ts` |
| Debug feature (server bounds) | `packages/shared/src/debug/features/<id>.ts`; register in `DEBUG_SERVER_FEATURES`; add web labels in `browserFlags/debug/features/` |
| Browser UI preference | New feature under `browserFlags/ui/features/`; register in `browserFlags/ui/catalog.ts` |
| UI tab / panel | `apps/web/src/components/`; wire in `App.tsx` + `Nav.tsx` |
| API client call | `apps/web/src/queries/<domain>.api.ts` + hook in `useSessionApi.ts` / dedicated query hook |
| Co-located styles | `<Component>.module.css` beside the component; shared tokens in `styles.css` |

## Test location convention

Mirrored `src/tests/` trees (not colocated): server `services/` + `pause/`; web `utils/`. Each package runs its own tests; packages do not import each other's application source for tests.

## Config & build artifacts (ignored / not committed)

`node_modules/`, `dist/`, `coverage/`, `.env*`, `data/` — see `.gitignore`. Docker ignores `node_modules`, `dist`, `.git`, `*.md`, `.cursor`.
