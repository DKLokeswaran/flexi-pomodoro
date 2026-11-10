# Module & Component Inventory

Every committed TypeScript/TSX source file with exported symbols, key types, dependencies, and side effects. shadcn `components/ui/*` primitives are summarized (not every prop). Binary WAVs and vendored `.agents` skills omitted.

---

## `packages/shared`

### `src/bounds.ts`

| Export | Kind | Notes |
|--------|------|-------|
| `SETTINGS_BOUNDS` | const | Production min/max per session param |
| `SettingsBounds` | type | Mapped mins/maxes |

**Imports:** none.

### `src/debug/types.ts`

| Export | Kind |
|--------|------|
| `ServerFeatureDef<Id>` | type `{ id; applyBounds? }` — server-side debug feature (no UI meta) |

### `src/debug/features/shortDurations.ts`

| Export | Kind |
|--------|------|
| `SHORT_DURATIONS_MIN_OVERLAY` | const mins = 1 for durations |
| `shortDurationsServerFeature` | `ServerFeatureDef<"shortDurations">` |

**Side effects:** none (pure).

### `src/debug/catalog.ts`

| Export | Kind |
|--------|------|
| `DEBUG_SERVER_FEATURES` | readonly server feature list |
| `DebugFeatureId` | type |
| `DEBUG_FEATURE_IDS` | readonly ids |
| `DebugFlags` | type |
| `parseDebugFlags(raw)` | fn → strict Zod parse |
| re-exports | `ServerFeatureDef` |

### `src/debug/getSettingsBounds.ts`

| Export | Kind |
|--------|------|
| `getSettingsBounds(flags?)` | applies enabled server features' `applyBounds` |

### `src/index.ts`

**Re-exports:** bounds, debug catalog, `getSettingsBounds`, `SHORT_DURATIONS_MIN_OVERLAY`, `shortDurationsServerFeature`, `pausedSecAt` / `plannedWorkProgressClockMs` / `plannedWorkSecAt` / `PlannedWorkProgressPhase`, `overlapSec` / `overlapSecFromIso`.

| Export | Kind |
|--------|------|
| `AlertIdSchema` / `AlertId` | Zod enum / type |
| `SESSION_API` | path constants object |
| `ANALYTICS_API` | `{ today: "/api/analytics/today" }` — day bounds from settings timezone (no day query params) |
| `WorkPauseStrategySchema` / `WorkPauseStrategy` | `"soft" \| "hard"` |
| `sessionParamsSchemaForBounds(bounds)` | Zod object for session timing fields |
| `SessionParamsSchema` / `SessionParams` | production-bounds Zod / type |
| `SessionOverridesSchema` / `SessionOverrides` | partial params |
| `isValidIanaTimeZone` / `TimeZoneSchema` | IANA timezone check via `Intl.DateTimeFormat` |
| `SettingsSchema` / `Settings` | params + mute + strategy + `timezone` |
| `SettingsPatch` | `Partial<Settings>` |
| `StartSessionBody` | type overrides + `debug?` |
| `DEFAULT_SETTINGS` | Settings (`timezone: "UTC"`) |
| phase interfaces, `Phase` | types (`Phase["kind"]` for the kind union) |
| `SessionStatus` | `"idle"\|"active"\|"completed"` |
| `SessionLiveStats` | type (`workedSec`, `deliberationSec`, `restSec`, `pausedSec`) |
| `TodayStats` / `TodayStatsResponse` | day-bucket alias of live stats + `clientDate` / `dayStart` / `dayEnd` |
| `pausedSecAt`, `plannedWorkSecAt`, `plannedWorkProgressClockMs` | Planned-work progress helpers (`liveStatsProgress.ts`) |
| `overlapSec`, `overlapSecFromIso` | Day-window overlap helpers (`overlapSec.ts`) — ms or ISO inputs |
| `AlertEvent`, `ActiveSession` | types |
| `IdleSnapshot`, `ActiveSnapshot`, `SessionSnapshot` | types (`IdleSnapshot.recoveryAbandonedMessage?`) |

**Dependencies:** `zod`, local bounds/debug modules.

---

## `apps/server`

### `src/index.ts`

No exports. **Side effects:** reads `PORT`/`HOST`, `buildApp()`, `listen`.

### `src/app.ts`

| Export | Kind |
|--------|------|
| `buildApp()` | async → `{ app }` |

**Side effects:** opens SQLite (`openDatabase`), hydrates settings, constructs `AnalyticsService`, injects session/phases stores into `SessionService`, `hydrateFromStore` + `runRecoveryTick` (or `abandonCorruptRuntime` on `CORRUPT_RUNTIME`), Fastify logger, registers routes, boot `finalizeDueDays`, starts scheduler (session `tickIfIdle` + client-day rollover `finalizeDueDays`), may register static files; `onClose` stops scheduler and `db.destroy()`.

**Deps:** `fastify`, `@fastify/static`, `node:path`/`fs`/`url`, `db`, services, routes, scheduler, `clientDay`.

### `src/db/index.ts`

| Export | Kind |
|--------|------|
| `AppStores` | type (`settings` / `session` / `phases` / `analytics`) |
| `createStores(db)` | builds purpose-split stores |
| `openDatabase(dataDir?)` | create Knex, migrate, return `{ db, stores, dataDir }` |
| re-exports | `createKnex`, `migrateLatest`, `resolveDataDir`, `sqlitePath`, store classes |

### `src/db/knex.ts`

| Export | Kind |
|--------|------|
| `resolveDataDir(env?, cwd?)` | `DATA_DIR` → else `/data` when `NODE_ENV=production` → else `./data` |
| `sqlitePath(dataDir)` | `…/flexi-pomodoro.sqlite3` |
| `createKnex(dataDir)` | better-sqlite3 Knex client; creates data dir |
| `migrateLatest(db)` | `db.migrate.latest()` |

### `src/db/stores/settingsStore.ts`

| Export | Kind |
|--------|------|
| `SettingsStore` | class |

**Public methods:** `load()`, `save(settings, updatedAtMs?)`, `ensureSeeded(defaults?)`.

### `src/db/stores/sessionStore.ts`

| Export | Kind |
|--------|------|
| `SessionStore` | class |
| `SessionRow` / `SessionRuntimeRow` / `SessionStatusRow` | types |
| `SessionStore.paramsColumns(params)` | static helper |

**Public methods:** `transaction`, `insertSession`, `upsertRuntime`, `updateRuntimeStats`, `finalizeSession`, `clearRuntime`, `getRuntime`, `getSession`, `markInterrupted`.

### `src/db/stores/phasesStore.ts`

| Export | Kind |
|--------|------|
| `PhasesStore` | class |
| Phase/outcome row types | `PhaseKind`, open-row types, ended-reason / outcome unions |

**Public methods:** `openPlannedWork` / `completePlannedWork` / `updatePlannedWorkPause`; `openDecision` / `completeDecision` / `deleteDecisionPhase`; `openShortRestAck` / `completeShortRestAck`; `openExtendedWork` / `completeExtendedWork`; `openRest` / `completeRest`; `openPauseSlice` / `closePauseSlice`; hydrate loaders (`getPlannedWork`, `getDecision`, `getShortRestAck`, `getExtendedWork`, `getRest`, `getOpenPauseSliceId`); list helpers (`listDecisionRows`, `listPlannedWork`, …) and `getPhaseKind`.

### `src/db/stores/analyticsStore.ts`

| Export | Kind |
|--------|------|
| `AnalyticsStore` | class |
| `DailyStatsRow` / `TimedClosedRow` / `PlannedWorkClosedRow` / `PauseSliceClosedRow` | types |

**Public methods:** overlapping closed-row lists (`listClosedPlannedWorkOverlapping`, pause slices, extended work, decisions, short-rest acks, rests); `upsertDailyStats`, `getLatestFinalizedClientDate`, `getDailyStats`, `getEarliestClosedPhaseStartedAt`.

### `src/scheduler.ts`

| Export | Kind |
|--------|------|
| `Scheduler` | interface `start`/`stop` |
| `IntervalSchedulerOptions` | interface (`onTick` may return `void` or `Promise<void>`) |
| `IntervalScheduler` | class implementing `Scheduler` |

**Methods:** `start()`, `stop()`. Uses `setInterval` (`unref` if available); fires `onTick` without awaiting (errors are not surfaced).

### `src/routes/index.ts`

| Export | Kind |
|--------|------|
| `RouteDeps` | `{ settings, session, analytics }` |
| `registerRoutes(app, deps)` | registers health/settings/session/analytics |

### `src/routes/health.routes.ts`

| Export | Kind |
|--------|------|
| `registerHealthRoutes(app)` | GET health |

### `src/routes/settings.routes.ts`

| Export | Kind |
|--------|------|
| `registerSettingsRoutes(app, settings)` | GET/PUT settings |

**Deps:** `errorReply` from `../utils/errorReply.js`.

### `src/routes/session.routes.ts`

| Export | Kind |
|--------|------|
| `registerSessionRoutes(app, { settings, session })` | session REST + SSE |

**Side effects:** hijacks reply for SSE; heartbeats; subscribe/unsubscribe.

**Deps:** `errorReply` from `../utils/errorReply.js`.

### `src/routes/analytics.routes.ts`

| Export | Kind |
|--------|------|
| `registerAnalyticsRoutes(app, analytics)` | GET `ANALYTICS_API.today` → `analytics.todayStats()` |

### `src/pause/types.ts`

| Export | Kind | Notes |
|--------|------|-------|
| `WorkPauseStrategyId` | type re-export | Shared `"soft" \| "hard"` |
| `PlannedEndAction` | type | `"rest" \| "decision"` |
| `WorkPauseStrategy` | interface | Pause plugin: `id`, `onPause`, `onResume`, `isCountdownFrozen`, `onPlannedEnd` |

**Deps:** `@flexi-pomodoro/shared` (`PlannedWorkPhase`).

### `src/pause/softPause.ts`

| Export | Kind | Notes |
|--------|------|-------|
| `softPauseStrategy` | `WorkPauseStrategy` | `id: "soft"`; countdown not frozen; still-paused at planned end → `"rest"` |

**Deps:** shared `PlannedWorkPhase`, `msToIso` / `parseIso` from `../utils/iso.js`.

### `src/pause/hardPause.ts`

| Export | Kind | Notes |
|--------|------|-------|
| `hardPauseStrategy` | `WorkPauseStrategy` | `id: "hard"`; freezes countdown; shifts `plannedEndAt` on resume; planned end → `"decision"` |

**Deps:** shared `PlannedWorkPhase`, `msToIso` / `parseIso` from `../utils/iso.js`.

### `src/pause/registry.ts`

| Export | Kind | Notes |
|--------|------|-------|
| `PauseStrategyRegistry` | class | `get(id)` lookup; constructor takes a strategy list |
| `defaultPauseRegistry()` | fn | Registers `softPauseStrategy` and `hardPauseStrategy` |

### `src/pause/index.ts`

Barrel: `defaultPauseRegistry`, `PauseStrategyRegistry`, `softPauseStrategy`, `hardPauseStrategy`, pause types.

### `src/utils/errorReply.ts`

| Export | Kind |
|--------|------|
| `errorReply(error)` | `{ statusCode, body }` for Zod / SettingsError / SessionError |

Unknown errors are rethrown.

### `src/utils/settingsValidation.ts`

| Export | Kind |
|--------|------|
| `SettingsPatchSchema` | `SettingsSchema.partial()` for PUT body parse |
| `mergeSessionParams(settings, overrides?, options?)` | → `SessionParams` under debug-aware bounds |
| `parseStartSessionBody(body)` | → `{ debug, overrides }` |
| `parseSettingsPatch(current, patch)` | → `Settings` |

**Deps:** shared `SettingsSchema`, `sessionParamsSchemaForBounds`, `getSettingsBounds`, `parseDebugFlags`.

### `src/utils/iso.ts`

| Export | Kind |
|--------|------|
| `msToIso(ms)` | millisecond timestamp → ISO-8601 string |
| `parseIso(value)` | ISO-8601 string → milliseconds since epoch |
| `elapsedSecFromIso(startedAt, nowMs)` | whole seconds elapsed between ISO start and `nowMs` |

**Imports:** none.

### `src/utils/asyncMutex.ts`

| Export | Kind |
|--------|------|
| `AsyncMutex` | class |

**Methods:** `isLocked()`, `runExclusive(fn)` (FIFO waiters), `tryRunExclusive(fn)` (returns `null` when skipped).

**Used by:** `SessionService` to serialize ticks and mutating commands.

### `src/utils/clientDay.ts`

| Export | Kind |
|--------|------|
| `clientDateAt(ms, timeZone)` | `YYYY-MM-DD` in client timezone |
| `addClientDays(clientDate, deltaDays)` | calendar-day arithmetic |
| `dayBoundsIso(clientDate, timeZone)` | half-open UTC ISO + ms bounds |
| `ClientDayBounds` | type |

**Deps:** `luxon`. Overlap clipping uses shared `overlapSecFromIso`.

### `src/services/settings.service.ts`

| Export | Kind |
|--------|------|
| `SettingsError` | class |
| `toSettingsError(error)` | normalizer |
| `SettingsService` | class |

**Public methods**

| Method | Returns |
|--------|---------|
| `constructor(store)` | requires `SettingsStore` |
| `hydrate()` | `Promise<void>` — load or seed defaults |
| `get()` | `Settings` copy |
| `update(partial)` | `Promise<Settings>` — validate, persist, return copy |
| `resolveSessionParams(overrides?, debug?)` | `SessionParams` |

### `src/services/analytics.service.ts`

| Export | Kind |
|--------|------|
| `AnalyticsService` | class |
| `EMPTY_TODAY_STATS` | zeroed `TodayStats` |

**Public methods:** `todayStats()`, `dayStats(clientDate)`, `finalizeDueDays()` — overlap-clip closed phases via `AnalyticsStore` + Luxon day bounds + shared `overlapSecFromIso`; finalize catch-up writes `daily_stats` through yesterday.

### `src/services/session.service.ts`

| Export | Kind |
|--------|------|
| `SessionError` | class |
| `SnapshotListener` | `(snapshot) => void` |
| `SessionServiceStores` | `{ session; phases }` |
| `SessionService` | class |

**Public methods**

| Method | Signature / purpose |
|--------|---------------------|
| `constructor(stores, pauseRegistry?)` | requires `SessionServiceStores`; registry defaults to `defaultPauseRegistry()` |
| `subscribe(listener, sinceSeq?)` | → unsubscribe |
| `getAlertSeq()` | number |
| `hydrateFromStore()` | `Promise<boolean>` — rebuild `ActiveSession` from runtime + open phase; `true` when restored; throws `CORRUPT_RUNTIME` on inconsistent rows |
| `runRecoveryTick(nowMs?)` | `Promise<void>` — one boot catch-up; phases closed in this tick use `endedReason: "recovery"` |
| `abandonCorruptRuntime(nowMs?)` | `Promise<void>` — mark `interrupted`, clear runtime, set idle `recoveryAbandonedMessage` |
| `getSnapshot(nowMs?, sinceSeq?)` | SessionSnapshot — pure read (no wall-clock catch-up) |
| `start(params, nowMs?, pauseStrategy?)` | `Promise<SessionSnapshot>` — resolves `pausePlugin` from registry (default `"soft"`; start route passes `settings.workPauseStrategy`); clears recovery notice |
| `pause(nowMs?)` | `Promise<SessionSnapshot>` — delegates to `pausePlugin.onPause` |
| `resume(nowMs?)` | `Promise<SessionSnapshot>` — delegates to `pausePlugin.onResume` |
| `ackRest(nowMs?)` | `Promise<SessionSnapshot>` |
| `ackWork(nowMs?)` | `Promise<SessionSnapshot>` — short-rest ack → next-cycle planned work running |
| `continueExtended(nowMs?)` | `Promise<SessionSnapshot>` |
| `startRest(nowMs?)` | `Promise<SessionSnapshot>` |
| `endLongRest(nowMs?)` | `Promise<SessionSnapshot>` |
| `tickIfIdle(nowMs?, notify?)` | `Promise<boolean>` — scheduler catch-up; `false` when mutex busy |

**Side effects:** mutates in-memory session/alerts/liveStats under `AsyncMutex`; write-through SQLite transactions on transitions; notifies listeners; `randomUUID` on start. Mutating commands tick via `beginActiveCommand` → `tickUnlocked` while holding the mutex.

**Private helpers (not exported):** `syncRuntime`, `persistPauseOpen` / `persistPauseClose`, `addDeliberation`, `restSecAt`, `liveStatsWithProgress`, `advanceWorkDecision`, `advanceShortRestAck`, `enterShortRestAckPhase`, `commitPlannedWork`, `commitRest`, `tickUnlocked`, `closeReason`. Uses shared `pausedSecAt` / `plannedWorkSecAt` for planned-work focus and pause totals.

### Tests

`src/tests/services/{session,settings,analytics}.service.test.ts`, `session.attribution.test.ts`, `session.recovery.test.ts`, `session.recovery.matrix.test.ts`, `settings.service.persist.test.ts`, `src/tests/db/{settings,session,phases,analytics}Store.test.ts`, `src/tests/routes/analytics.routes.test.ts`, `src/tests/helpers/{mockSettingsStore,mockSessionStores,tempDatabase}.ts`, `src/tests/pause/*`, `src/tests/utils/{asyncMutex,clientDay}.test.ts` — no production exports (see [testing.md](./testing.md)).
---

## `apps/web` — entry & shell

### `src/main.tsx`

No exports. **Side effects:** mounts React root; `UiFlagsProvider` + `DebugFlagsProvider` + `ToastProvider`; imports `styles.css`.

### `src/App.tsx`

| Export | Props / notes |
|--------|----------------|
| `App()` | Header `Logo` + title; tab state; settings query; `useSeedTimezone`; session stream; renders tabs |

### `src/vite-env.d.ts`

Declares `__APP_VERSION__: string`.

---

## Constants

### `src/constants/labels.ts`

| Export | Value role |
|--------|------------|
| `DECISION_WINDOW_LABEL` | UI label |
| `REQUEST_FAILED` | Error fallback |

### `src/constants/about.ts`

Exports: `GITHUB_REPO`, `TAGLINE`, `RELEASE_STATUS`, types (`FeatureStatus`, `AboutFeature`, …), data arrays including `FEATURES` (Hard pause, Short-rest acknowledgement, Live session stats, Idle today stats, SQLite persistence & crash recovery → `available`; Analytics dashboard → `soon`), `FONT_CREDITS`, `DESIGN_CREDIT` (Quiet Dark / flavors.design), and `CREDITS`.

---

## Utils

### `src/utils/time.ts`

| Export | Purpose |
|--------|---------|
| `formatMmSs(totalSec)` | Non-negative duration as `mm:ss` (total minutes may exceed 59) |
| `formatHhMmSs(totalSec)` | Non-negative duration as `mm:ss` under one hour, else `hh:mm:ss` |
| `secFromIso(iso, nowMs)` | signed seconds to event |
| `elapsedFromIso(iso, nowMs)` | non-negative elapsed |
| `minutesToSec` / `secToMinutes` | conversions |
| `remainingSecFromIso(iso, nowMs)` | non-negative countdown seconds |
| `formatLocalTime(ms)` | locale wall-clock label (hour + minute) |
| `formatApproxDuration(totalSec)` | approximate duration (`~2h 15m`) |

### `src/utils/ianaTimeZones.ts`

| Export | Purpose |
|--------|---------|
| `ianaTimeZones` | `Intl.supportedValuesOf("timeZone")` when available; else `["UTC"]` |

### `src/utils/seedTimezone.ts`

| Export | Purpose |
|--------|---------|
| `TZ_SEEDED_KEY` | localStorage gate `flexi-pomodoro:tzSeeded` |
| `seedTimezoneIfNeeded(settings, save)` | One-shot: if settings still `"UTC"` and browser IANA ≠ UTC, `PUT` browser zone; always sets the gate after a successful pass |

Internal helpers `pad2` and `splitSec` back both formatters.

### `src/utils/sessionProjection.ts`

| Export | Purpose |
|--------|---------|
| `SessionDurationParams` | work / short rest / long rest / cycles |
| `nominalSessionDurationSec(params)` | happy-path length (no decision windows) |
| `estimatedSessionEndMs(params, startMs)` | wall-clock end from a start instant |

### `src/utils/activeSessionProjection.ts`

| Export | Purpose |
|--------|---------|
| `remainingActiveSessionSec(snapshot, nowMs)` | happy-path remainder from current phase anchors |
| `activeEstimatedSessionEndMs(snapshot, nowMs)` | projected session end during an active session |

### `src/utils/fetchJson.ts`

| Export | Purpose |
|--------|---------|
| `parseJson<T>(response)` | throw on !ok; return JSON |

### `src/utils/errorMessage.ts`

| Export | Purpose |
|--------|---------|
| `errorMessage(error, fallback?)` | `Error.message` or fallback (`REQUEST_FAILED`) |

### `src/utils/alertSeqStore.ts`

| Export | Kind |
|--------|------|
| `AlertSeqStore` | class `get`/`set`/`advance` |
| `alertSeqStore` | singleton |
| `sinceSeqQueryString()` | `?sinceSeq=N` or empty |

**Side effects:** localStorage + `storage` listener.

### `src/utils/alertSeq.ts`

| Export | Purpose |
|--------|---------|
| `syncAlertSeq()` | fetch server seq → store |

### `src/utils/liveStats.ts`

| Export | Purpose |
|--------|---------|
| `liveStatsAt(snapshot, nowMs)` | Client-side live stats with in-phase extrapolation; uses shared `plannedWorkSecAt` / `pausedSecAt` / `plannedWorkProgressClockMs` |

### `src/utils/todayStats.ts`

| Export | Purpose |
|--------|---------|
| `EMPTY_TODAY_STATS` | zeroed `SessionLiveStats` |
| `openPhaseProgressClippedToDay(phase, dayStart, dayEnd, nowMs)` | Open-phase contribution clipped to the server day window |
| `todayDisplayStats(serverToday, openPhaseClipped)` | Closed server today + open-phase clip (not full live session stats) |

### `src/utils/playAlerts.ts`

| Export | Purpose |
|--------|---------|
| `playAlerts(events)` | play new Audio deltas (`placeholder-<AlertId>.wav`) |
| `alertsFromSnapshot(snapshot)` | extract pendingAlerts |

**Side effects:** Audio playback; advances watermark. Missing asset files fail silently in `audio.play()`.

### `src/utils/phaseClock.ts`

| Export | Kind |
|--------|------|
| `CountdownPhase` | type — `Phase` without `extended_work` |
| `phaseEndAt(phase)` | ISO end for countdown phases |
| `phaseDurationSec(phase)` | planned length in seconds |
| `phaseClockMs(phase, nowMs)` | clock anchor (respects hard-pause freeze) |

### `src/utils/dialProgress.ts`

| Export | Kind |
|--------|------|
| `DialProgress` | type `{ remaining; overtimeLaps }` |
| `CycleDotState` | `"done" \| "current" \| "pending"` |
| `dialProgress(phase, params, nowMs)` | main-arc fraction + overtime laps |
| `cycleDotStates(currentCycle, totalCycles)` | per-cycle dot states |

---

## Hooks

### `src/hooks/useNow.ts`

| Export | I/O |
|--------|-----|
| `ACTIVE_UI_TICK_MS` | `250` — active countdown / live stats |
| `IDLE_ESTIMATE_TICK_MS` | `60_000` — idle estimated-end label |
| `useNow(intervalMs: number \| null): number` | ticks at `intervalMs`; frozen when `null` |

### `src/hooks/sessionStream.sse.ts`

| Export | Kind |
|--------|------|
| `SessionListener` | type |
| `connectSessionStream(onSnapshot)` | → cleanup |

**Side effects:** EventSource, intervals, focus/visibility listeners, alert sync.

### `src/hooks/useSessionStream.ts`

| Export | Returns |
|--------|---------|
| `useSessionStream()` | `{ snapshot, setSnapshot }` |

Uses `useEffectEvent` for snapshot/idle handlers.

### `src/hooks/useSeedTimezone.ts`

| Export | Purpose |
|--------|---------|
| `useSeedTimezone(settings)` | After first settings fetch, runs `seedTimezoneIfNeeded` once; updates React Query cache on success |

---

## Queries

### `src/queries/health.api.ts`

`fetchHealth(): Promise<{ ok: boolean }>`

### `src/queries/settings.api.ts`

`fetchSettings()`, `saveSettings(partial)`

### `src/queries/session.api.ts`

`fetchAlertSeq()`, `fetchSession()`, `postAction(path, body?)`

### `src/queries/analytics.api.ts`

`fetchTodayStats()` — `GET ANALYTICS_API.today`

### `src/queries/useHealthQuery.ts`

`healthQueryKey`, `useHealthQuery()`

### `src/queries/useTodayStatsQuery.ts`

| Export | Kind |
|--------|------|
| `todayStatsQueryKey` | `["analytics", "today"]` |
| `useTodayDisplayStats(phase, nowMs)` | Closed server today + open-phase day clip; invalidates on phase change / day roll |

### `src/queries/useSessionApi.ts`

`settingsQueryKey`, `useSettingsQuery()`, `useSaveSettingsMutation()`, `useSessionActionMutation(onSnapshot)`

**Side effects:** toasts (pause/resume copy follows locked session strategy; includes `ackWork`); query cache updates; alert playback on action success; invalidates `todayStatsQueryKey` after settings save and session actions.

---

## Browser flag stores (`src/browserFlags/`)

### `createFlagCatalog.ts`

| Export | Kind |
|--------|------|
| `FeatureMeta`, `FeatureDef`, `FlagMap` | types |
| `createFlagCatalog(features)` | → `{ features, ids, meta, isEnabled, getFeature }` |

### `createFlagStore.tsx`

| Export | Kind |
|--------|------|
| `FlagStoreState`, `FlagStoreApi` | types |
| `createFlagStore(options)` | → `{ Provider, useFlagStore }` — localStorage + cross-tab sync |

### `persistedState.ts` / `readStoredRecord.ts`

Persistence helpers for flag stores (quota/private-mode safe).

### `debug/catalog.ts` + `debug/features/shortDurations.ts`

Web debug feature labels; ids must match shared `DebugFeatureId`.

Exports: `DEBUG_FEATURE_IDS`, `DEBUG_FEATURE_META`, re-exported types.

### `debug/provider.tsx`

| Export | Kind |
|--------|------|
| `DebugFlagsProvider` | provider (`hasGate: true`, key `flexi-pomodoro:debugFlags`) |
| `useDebugFlags()` | `{ debugMode, setDebugMode, flags, setFlag, isEnabled }` |

### `ui/catalog.ts` + `ui/features/classicTimer.ts` + `ui/features/hideContinueButton.ts`

Web UI preference catalog (plain TS, no Zod). Features: `classicTimer` (plain clock instead of dial), `hideContinueButton`.

Exports: `UI_FEATURE_IDS`, `UI_FEATURE_META`, `UiFeatureId`, `UiFlags`.

### `ui/provider.tsx`

| Export | Kind |
|--------|------|
| `UiFlagsProvider` | provider (`hasGate: false`, key `flexi-pomodoro:uiFlags`) |
| `useUiFlags()` | `{ flags, setFlag, isEnabled }` |

---

## Providers

| Export | Kind |
|--------|------|
| `ToastKind`, `ToastInput` | types |
| `ToastProvider({ children })` | provider + UI |
| `useToast()` | context hook |

---

## Lib

### `src/lib/utils.ts`

| Export | Kind |
|--------|------|
| `cn` | re-export from `cn` package for Tailwind class merging |

---

## Components

### `src/components/Logo.tsx`

| Export | Props |
|--------|-------|
| `Logo` | `{ size: number \| string; className? }` — decorative `/logo.svg`; pair with visible app name text |

### `src/components/Nav.tsx`

| Export | Props |
|--------|-------|
| `Nav` | `{ tab: Tab; onChange: (tab) => void }` |
| `Tab` | type union of tab ids |

### `src/components/NumberField.tsx`

| Props | Type |
|-------|------|
| `label` | string |
| `value` | number |
| `onChange` | `(value: number) => void` |
| `step?` | number (default 1) |
| `min?` | number |

### `src/components/Stubs.tsx`

| Export | Notes |
|--------|-------|
| `AnalyticsStub` | placeholder panel |

### `src/components/TimerTab.tsx`

| Props | Type |
|-------|------|
| `snapshot` | `SessionSnapshot \| null` |
| `onAction` | `(path, body?) => void` |
| `defaults` | `SessionTimingDefaults` |

### `src/components/timer/IdleStartForm.tsx`

| Export | Kind |
|--------|------|
| `SessionTimingDefaults` | type (duration fields) |
| `IdleStartForm` | props `{ defaults, onStart }` |

Owns `useNow(IDLE_ESTIMATE_TICK_MS)`. Shows estimated end (locale time) and approximate duration from per-session overrides via `sessionProjection`. Default layout uses a still `TimerDial` full ring; `classicTimer` UI flag keeps the plain clock. Renders `TodayStatsRow` via `useTodayDisplayStats(null, now)`.

### `src/components/timer/ActiveTimer.tsx`

| Props | Type |
|-------|------|
| `snapshot` | `ActiveSnapshot` |
| `onAction` | `(path: string) => void` |

Owns `useNow(ACTIVE_UI_TICK_MS)`. Derives `phase`, `params`, `pauseStrategy` from `snapshot.session`. Default layout: `TimerDial` with `dialProgress` / `cycleDotStates`, phase eyebrow, countdown, overtime comet, and Cycle / Phase ends / Estimated end readouts. Classic layout (`classicTimer` flag): plain `formatMmSs` clock via `timerDisplay` classes. Also renders hint, actions, live-stats HUD (`StatsCounters` + `liveStatsAt`), and a separate `TodayStatsRow` (`useTodayDisplayStats(phase, now)`). `short_rest_ack` reuses decision countdown fields. `hideContinueButton` UI flag filters Continue during work decision.

Planned-work clock uses `timerFrozenAt` when set (hard pause). Pause button label and phase suffix follow `snapshot.session.pauseStrategy`. Phase end/duration/clock helpers come from `phaseClock`.

### `src/components/timer/TodayStatsRow.tsx`

| Export | Kind |
|--------|------|
| `StatsCounters` | Worked / Deliberation / Rest / Paused row (shared by live + today) |
| `TodayStatsRow` | Labeled **Today** row wrapping `StatsCounters` |

### `src/components/timer/TimerDial.tsx`

| Export | Kind |
|--------|------|
| `DialReadout` | type `{ label; value }` |
| `TimerDial` | props `{ progress, eyebrow, clock, clockSuffix?, cycleDots?, readouts }` |

Internal: `DialFace`, `OvertimeComet`, `CycleDots`, `DialReadouts` (not exported).

### `src/components/timer/timerDisplay.ts`

| Export | Kind |
|--------|------|
| `timerDisplay` | const map of shared Tailwind class strings for idle/active timer chrome |

### `src/components/SettingsTab.tsx`

| Props | Type |
|-------|------|
| `settings` | Settings |
| `onSave` | `(s: Settings) => void` |
| `locked` | boolean |
| `saving?` | boolean |

Draft includes timing fields, `timezone`, and `enableHardPause` (maps to `workPauseStrategy`). Sections: **Save defaults** (includes searchable IANA timezone combobox for analytics day bounds), **Browser preferences** (UI flags), **Debug** (gated debug flags). **Experimental features** gate reveals **Enable hard pause (experimental)**; auto-opens when saved defaults use `"hard"`.

### `src/components/AboutTab.tsx`

| Export | Props |
|--------|-------|
| `AboutTab` | none (uses health query + toast) |

Shows `Logo`, diagnostics, link cards, and credits (including Quiet Dark / flavors.design). Internal helpers: `StatusPill`, `CreditRow`, `healthUi`, `healthClassName`, `buildDiagnostics` (not exported).

### `src/components/ui/*` (shadcn)

Committed primitives in use: `badge`, `button`, `card`, `checkbox`, `collapsible`, `combobox`, `field`, `input`, `input-group`, `label`, `separator`, `textarea`. Generated/adapted for base-nova; compose via Tailwind + `cn`.

### `src/components/about/AboutAccordion.tsx`

| Props | Type |
|-------|------|
| `title` | string |
| `summary?` | string |
| `defaultOpen?` | boolean |
| `children` | ReactNode |

### `src/components/about/AboutIcon.tsx`

| Props | Type |
|-------|------|
| `icon` | LinkIcon |
| `className?` | string |

### `src/components/about/LinkCard.tsx`

| Props | Type |
|-------|------|
| `label` | string |
| `description?` | string |
| `cta` | string |
| `href?` | string |
| `external?` | boolean |
| `icon` | LinkIcon |
| `soon?` | boolean |

---

## Styles

Global `styles.css` only (Tailwind + Quiet Dark theme + type utilities). No CSS modules remain.

---

## Config / non-TS

Workspace manifests, Docker files, `apps/web/DESIGN.md`, `components.json`, `vite.config.ts` (Tailwind plugin, `@` alias, `__APP_VERSION__`, proxy), HTML shell + public logo/favicons — see [build-and-deploy.md](./build-and-deploy.md) and [structure.md](./structure.md).
