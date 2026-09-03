# Architecture

## Architectural style

Flexi Pomodoro is an **npm-workspace monorepo** with three packages:

| Package | Role |
|---------|------|
| `@flexi-pomodoro/shared` | Domain types, Zod schemas, `SESSION_API` path constants, debug feature catalog |
| `@flexi-pomodoro/server` | Fastify HTTP/SSE API, in-memory session engine, settings store, static web serving |
| `@flexi-pomodoro/web` | React SPA (Vite); talks to the server via REST + Server-Sent Events |

Backend style is **layered**: composition root (`app.ts`) → routes → services → pause plugins → (no persistence layer yet; M3 SQLite is planned). The session engine is an **in-memory state machine** advanced by wall-clock ticks (`IntervalScheduler`). Pause policy is injected as a `WorkPauseStrategy` plugin, not inlined in the engine.

Frontend style is **feature-oriented folders** under `apps/web/src`: components (by tab/feature), providers, queries (API + React Query hooks), hooks (SSE stream), utils, constants. Tab switching is local React state (no client router).

## Layer diagram

```mermaid
flowchart TB
  subgraph web ["apps/web"]
    UI["Components / tabs"]
    Prov["Providers: UiFlags, DebugFlags, Toast"]
    Q["queries/* + React Query"]
    SSE["sessionStream.sse + useSessionStream"]
    UI --> Prov
    UI --> Q
    UI --> SSE
  end

  subgraph server ["apps/server"]
    Routes["routes/*.routes.ts"]
    SettSvc["SettingsService"]
    SessSvc["SessionService"]
    Pause["PauseStrategyRegistry"]
    Sched["IntervalScheduler"]
    Routes --> SettSvc
    Routes --> SessSvc
    SessSvc --> Pause
    Sched -->|"tick every 250ms"| SessSvc
  end

  Shared["packages/shared"]
  web --> Shared
  server --> Shared
  Q -->|"fetch /api"| Routes
  SSE -->|"EventSource /api/session/events"| Routes
```

## Design patterns in use

| Pattern | Where | Notes |
|---------|-------|-------|
| **Composition root / manual DI** | `apps/server/src/app.ts` `buildApp()` | Instantiates `SettingsService`, `SessionService`, `IntervalScheduler`; passes deps into `registerRoutes` |
| **Service layer** | `SettingsService`, `SessionService` | Business rules and state; routes stay thin |
| **Observer / pub-sub** | `SessionService.subscribe` / `notify` | SSE clients receive snapshot deltas |
| **Strategy (scheduler interface)** | `Scheduler` + `IntervalScheduler` | Comment in `scheduler.ts`: swap for deadline-based scheduler later |
| **Strategy (pause plugins)** | `PauseStrategyRegistry` + `WorkPauseStrategy` | Engine calls `onPause` / `onResume` / `isCountdownFrozen` / `onPlannedEnd`; default registry registers `soft` and `hard` |
| **Catalog / plugin registration** | `DEBUG_SERVER_FEATURES` in `packages/shared/src/debug/catalog.ts` | Server debug features register id + optional `applyBounds`; web labels live in `browserFlags/debug/` |
| **Browser flag stores** | `createFlagCatalog` + `createFlagStore` in `apps/web/src/browserFlags/` | Shared localStorage-backed stores for debug flags (gated) and UI preferences (ungated) |
| **Schema-driven validation** | Zod schemas in shared | Shared between server routes and client start body |
| **Watermark / cursor** | Server `listenerCursors` + client `AlertSeqStore` | Alert delivery is delta-only via `sinceSeq` |
| **SPA fallback** | `app.setNotFoundHandler` | Non-API 404s serve `index.html` when `WEB_DIST` exists |

## Inversion of control / DI

No DI container. Wiring is explicit:

```typescript
// apps/server/src/app.ts (committed pattern)
const settings = new SettingsService();
const session = new SessionService(); // defaultPauseRegistry: soft + hard
await registerRoutes(app, { settings, session });
const scheduler = new IntervalScheduler({
  intervalMs: 250,
  onTick: (nowMs) => session.tick(nowMs, true),
});
```

On the web, React Context provides `UiFlagsProvider`, `DebugFlagsProvider` (both from `browserFlags/`), and `ToastProvider`; TanStack `QueryClientProvider` wraps the tree in `main.tsx`.

## Cross-cutting concerns

| Concern | Implementation |
|---------|----------------|
| Logging | Fastify `{ logger: true }` |
| Validation | Zod (`SessionParamsSchema`, `SettingsPatchSchema`, `parseStartSessionBody`, `parseDebugFlags`) |
| Error mapping | Shared `errorReply` in `apps/server/src/utils/errorReply.ts` → HTTP 400/403/409 + `{ error, code }` |
| Auth / rate limit / tracing | Not found in committed history |
| Static assets | `@fastify/static` when web dist is discoverable |
| Real-time | SSE with 25s heartbeat comments; client also polls every 5 minutes and on focus/visibility |

## Backend request lifecycle

1. **Entry** — `apps/server/src/index.ts` reads `PORT` / `HOST`, calls `buildApp()`, `listen`.
2. **App** — Fastify instance; services + routes + scheduler; optional static hosting.
3. **Route** — e.g. `POST /api/session/start` parses body via `parseStartSessionBody`, resolves params via `settings.resolveSessionParams`, calls `session.start`.
4. **Service** — mutates in-memory session; `notify()` pushes snapshots to SSE subscribers.
5. **Tick** — every 250ms `session.tick(nowMs, true)` catch-up advances due phase boundaries (wall-clock).

There are **no DB transactions**. Session and settings live in process memory only.

## Session phase state machine

```mermaid
stateDiagram-v2
  [*] --> planned_work: start
  planned_work --> decision: plannedEnd (not paused)
  planned_work --> short_rest: plannedEnd while paused, cycle < N
  planned_work --> long_rest: plannedEnd while paused, cycle >= N
  planned_work --> planned_work: pause / resume
  decision --> short_rest: ackRest, cycle < N
  decision --> long_rest: ackRest, cycle >= N
  decision --> extended_work: continue (from click) OR timeout (backdated)
  extended_work --> short_rest: startRest, cycle < N
  extended_work --> long_rest: startRest, cycle >= N
  short_rest --> short_rest_ack: plannedEnd
  short_rest_ack --> planned_work: ackWork (running) OR timeout (paused)
  long_rest --> [*]: plannedEnd OR endLongRest
```

`N` is `cyclesBeforeLongRest`. Rest kind is chosen by `cycleIndex >= N` → long rest, else short rest.

Short rest ends enter `short_rest_ack` (not running work). Explicit `ackWork` starts the next cycle running; ack timeout emits `short_rest_ack_expired` and starts the next cycle immediately paused via the active pause strategy. Snapshots include `liveStats` with in-phase progress at `serverNow`; the web HUD extrapolates locally via `liveStatsAt()` and `ActiveTimer`'s `useNow` tick.

Decision timeout attributes elapsed decision time to **extended work** (`startedAt` = decision start). Explicit **continue** starts extended work at the click time (decision elapsed excluded). Soft pause through planned end **skips decision** and enters rest at planned end (`onPlannedEnd` → `"rest"`). While a strategy reports `isCountdownFrozen`, planned-end ticks are skipped.

## Pause plugins

Pause behavior lives under `apps/server/src/pause/`, not inline in the session engine.

| Piece | Role |
|-------|------|
| `WorkPauseStrategy` | Plugin contract: `id`, `onPause`, `onResume`, `isCountdownFrozen`, `onPlannedEnd` |
| `PauseStrategyRegistry` | Lookup by strategy id; constructor registers plugins for this process |
| `defaultPauseRegistry()` | Production table: `softPauseStrategy` + `hardPauseStrategy` |
| `softPauseStrategy` | Countdown keeps running; `plannedEndAt` unchanged; still-paused at planned end → auto-rest |
| `hardPauseStrategy` | Countdown frozen via `timerFrozenAt`; `plannedEndAt` shifts on resume; planned end → decision |

`SessionService` resolves `pausePlugin` at `start` from the registry using `settings.workPauseStrategy` (passed from the start route) and clears it when the session completes. HTTP is strategy-agnostic: `POST /api/session/pause` and `POST /api/session/resume`.

## Frontend architecture

### Component hierarchy

```
main.tsx
  QueryClientProvider
    UiFlagsProvider
      DebugFlagsProvider
        ToastProvider
          App
          Nav
          TimerTab | SettingsTab | AnalyticsStub | AboutTab
            TimerTab → IdleStartForm | ActiveTimer
            AboutTab → AboutAccordion, LinkCard, AboutIcon
```

### Smart vs presentational

| Kind | Examples |
|------|----------|
| Container / smart | `App` (queries + stream + mutations), `SettingsTab` (draft + browser prefs + debug), `AboutTab` (health + clipboard), `useSessionStream` |
| Presentational | `Nav`, `NumberField`, `LinkCard`, `AboutAccordion`, `ActiveTimer` (receives `ActiveSnapshot`; owns its own `useNow` tick) |

### Routing

No React Router. `App` holds `tab: "timer" | "settings" | "analytics" | "about"` and conditionally renders panels.

### Real-time / countdown

- **Authoritative phase changes**: SSE (`/api/session/events`) + hybrid poll fallback (`sessionStream.sse.ts`).
- **UI countdown**: each leaf owns its clock. `ActiveTimer` uses `useNow(ACTIVE_UI_TICK_MS)` (250ms) for remaining/overtime from ISO anchors — no sub-second API polling. Hard pause uses `timerFrozenAt` as the clock anchor while paused. `IdleStartForm` uses `useNow(IDLE_ESTIMATE_TICK_MS)` (60s) only for the absolute estimated-end label.
- **Estimated session end**: idle shows locale wall-clock end plus approximate duration (`sessionProjection` — nominal path: `N×work + (N−1)×short rest + long rest`, no decision windows). Active shows a live end time via `activeEstimatedSessionEndMs` (forward remainder from current phase anchors; deliberation, extended work, and hard-pause slip shift the projection).
- **Live stats HUD**: `ActiveTimer` shows Worked / Deliberation / Rest counters. `liveStatsAt(snapshot, now)` strips in-phase progress at `serverNow` and re-adds at local `now`, mirroring server `liveStatsWithProgress` formulas.
- **Browser preferences**: `hideContinueButton` UI flag (localStorage `flexi-pomodoro:uiFlags`) omits the Continue action during the work-decision phase.
- **Pause actions**: planned-work buttons call `SESSION_API.pause` / `SESSION_API.resume`. Label and phase suffix follow the locked session strategy (`Soft pause` vs `Hard pause (experimental)`). Toasts mirror the same strategy.
- **Settings**: Experimental features gate exposes **Enable hard pause (experimental)**; unchecked maps to `workPauseStrategy: "soft"`, checked to `"hard"`. Saved with **Save defaults**; locked while a session is active.

### Code splitting

Not found in committed history (no `React.lazy` / dynamic import of routes).

## Alert delivery model

1. Server appends `{ seq, id }` to an alert log on transitions.
2. Snapshots include `pendingAlerts` filtered by client `sinceSeq`.
3. Client `AlertSeqStore` persists watermark in `localStorage` (`flexi-pomodoro:lastPlayedAlertSeq`).
4. On idle after active, client `syncAlertSeq()` aligns with server high-water and may reset history server-side after session end.

## Persistence (current vs planned)

| Data | M1 (committed) | Planned |
|------|----------------|---------|
| Settings | In-memory `SettingsService` (lost on restart) | SQLite (M3) |
| Session | In-memory `SessionService` | SQLite + crash recovery |
| Debug prefs | Browser `localStorage` (`flexi-pomodoro:debugFlags`) | Client-only |
| UI prefs | Browser `localStorage` (`flexi-pomodoro:uiFlags`) | Client-only |
| Alert watermark | Browser `localStorage` | Client-only |
| Docker volume `/data` | Mounted stub; unused | Persistence target |
