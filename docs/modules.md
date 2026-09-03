# Module & Component Inventory

Every committed TypeScript/TSX source file with exported symbols, key types, dependencies, and side effects. CSS modules export class-name maps only (omitted field-by-field). Binary WAVs omitted.

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

**Re-exports:** bounds, debug catalog, `getSettingsBounds`, `SHORT_DURATIONS_MIN_OVERLAY`, `shortDurationsServerFeature`.

| Export | Kind |
|--------|------|
| `AlertIdSchema` / `AlertId` | Zod enum / type |
| `SESSION_API` | path constants object |
| `WorkPauseStrategySchema` / `WorkPauseStrategy` | `"soft" \| "hard"` |
| `SessionParamsSchema` / `SessionParams` | Zod / type |
| `SessionOverridesSchema` / `SessionOverrides` | partial params |
| `SettingsSchema` / `Settings` | params + mute + strategy |
| `SettingsPatchSchema` / `SettingsPatch` | partial settings |
| `StartSessionBody` | type overrides + `debug?` |
| `DEFAULT_SETTINGS` | Settings |
| `mergeSessionParams(settings, overrides?, options?)` | → SessionParams |
| `parseStartSessionBody(body)` | → `{ debug, overrides }` |
| `parseSettingsPatch(current, patch)` | → Settings |
| `PhaseKind`, phase interfaces, `Phase`, `RestKind` | types |
| `SessionStatus` | `"idle"\|"active"\|"completed"` |
| `SessionLiveStats` | type |
| `AlertEvent`, `ActiveSession` | types |
| `IdleSnapshot`, `ActiveSnapshot`, `SessionSnapshot` | types |

**Dependencies:** `zod`, local bounds/debug modules.

---

## `apps/server`

### `src/index.ts`

No exports. **Side effects:** reads `PORT`/`HOST`, `buildApp()`, `listen`.

### `src/app.ts`

| Export | Kind |
|--------|------|
| `buildApp()` | async → `{ app, settings, session, scheduler }` |

**Side effects:** Fastify logger; starts scheduler; may register static files; `onClose` stops scheduler.

**Deps:** `fastify`, `@fastify/static`, `node:path`/`fs`/`url`, services, routes, scheduler.

### `src/scheduler.ts`

| Export | Kind |
|--------|------|
| `Scheduler` | interface `start`/`stop` |
| `IntervalSchedulerOptions` | interface |
| `IntervalScheduler` | class implementing `Scheduler` |

**Methods:** `start()`, `stop()`. Uses `setInterval` (`unref` if available).

### `src/routes/index.ts`

| Export | Kind |
|--------|------|
| `RouteDeps` | `{ settings, session }` |
| `registerRoutes(app, deps)` | registers health/settings/session |

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

### `src/utils/iso.ts`

| Export | Kind |
|--------|------|
| `msToIso(ms)` | millisecond timestamp → ISO-8601 string |
| `parseIso(value)` | ISO-8601 string → milliseconds since epoch |
| `elapsedSecFromIso(startedAt, nowMs)` | whole seconds elapsed between ISO start and `nowMs` |

**Imports:** none.

### `src/services/settings.service.ts`

| Export | Kind |
|--------|------|
| `SettingsError` | class |
| `toSettingsError(error)` | normalizer |
| `SettingsService` | class |

**Public methods**

| Method | Returns |
|--------|---------|
| `get()` | `Settings` copy |
| `update(partial)` | `Settings` |
| `resolveSessionParams(overrides?, debug?)` | `SessionParams` |

### `src/services/session.service.ts`

| Export | Kind |
|--------|------|
| `SessionError` | class |
| `SnapshotListener` | `(snapshot) => void` |
| `SessionService` | class |

**Public methods**

| Method | Signature / purpose |
|--------|---------------------|
| `constructor(pauseRegistry?)` | defaults to `defaultPauseRegistry()` |
| `subscribe(listener, sinceSeq?)` | → unsubscribe |
| `getAlertSeq()` | number |
| `getSnapshot(nowMs?, sinceSeq?)` | SessionSnapshot |
| `start(params, nowMs?, pauseStrategy?)` | SessionSnapshot — resolves `pausePlugin` from registry (default `"soft"`; start route passes `settings.workPauseStrategy`) |
| `pause(nowMs?)` | SessionSnapshot — delegates to `pausePlugin.onPause` |
| `resume(nowMs?)` | SessionSnapshot — delegates to `pausePlugin.onResume` |
| `ackRest(nowMs?)` | SessionSnapshot |
| `ackWork(nowMs?)` | SessionSnapshot — short-rest ack → next-cycle planned work running |
| `continueExtended(nowMs?)` | SessionSnapshot |
| `startRest(nowMs?)` | SessionSnapshot |
| `endLongRest(nowMs?)` | SessionSnapshot |
| `tick(nowMs?, notify?)` | void — wall-clock catch-up |

**Side effects:** mutates in-memory session/alerts/liveStats; notifies listeners; `randomUUID` on start.

**Private helpers (not exported):** `addDeliberation`, `plannedWorkSecAt`, `restSecAt`, `liveStatsWithProgress`, `advanceWorkDecision`, `advanceShortRestAck`, `enterShortRestAckPhase`, `commitPlannedWork`, `commitRest`.

### Tests

`src/tests/services/session.service.test.ts`, `settings.service.test.ts`, `src/tests/pause/softPause.test.ts`, `hardPause.test.ts` — no production exports (see [testing.md](./testing.md)).

---

## `apps/web` — entry & shell

### `src/main.tsx`

No exports. **Side effects:** mounts React root; `UiFlagsProvider` + `DebugFlagsProvider` + `ToastProvider`; imports `styles.css`.

### `src/App.tsx`

| Export | Props / notes |
|--------|----------------|
| `App()` | Tab state; settings query; session stream; renders tabs |

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

Exports: `GITHUB_REPO`, `TAGLINE`, `RELEASE_STATUS`, types (`FeatureStatus`, `AboutFeature`, …), and data arrays including `FEATURES` (Hard pause, Short-rest acknowledgement, Live session stats → `available`).

---

## Utils

### `src/utils/time.ts`

| Export | Purpose |
|--------|---------|
| `formatMmSs(totalSec)` | `MM:SS` with optional minus |
| `secFromIso(iso, nowMs)` | signed seconds to event |
| `elapsedFromIso(iso, nowMs)` | non-negative elapsed |
| `minutesToSec` / `secToMinutes` | conversions |
| `remainingSecFromIso(iso, nowMs)` | non-negative countdown seconds |
| `formatLocalTime(ms)` | locale wall-clock label (hour + minute) |
| `formatApproxDuration(totalSec)` | approximate duration (`~2h 15m`) |

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
| `liveStatsAt(snapshot, nowMs)` | Client-side live stats with in-phase extrapolation (mirrors server formulas) |

### `src/utils/playAlerts.ts`

| Export | Purpose |
|--------|---------|
| `playAlerts(events)` | play new Audio deltas |
| `alertsFromSnapshot(snapshot)` | extract pendingAlerts |

**Side effects:** Audio playback; advances watermark.

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

---

## Queries

### `src/queries/health.api.ts`

`fetchHealth(): Promise<{ ok: boolean }>`

### `src/queries/settings.api.ts`

`fetchSettings()`, `saveSettings(partial)`

### `src/queries/session.api.ts`

`fetchAlertSeq()`, `fetchSession()`, `postAction(path, body?)`

### `src/queries/useHealthQuery.ts`

`healthQueryKey`, `useHealthQuery()`

### `src/queries/useSessionApi.ts`

`settingsQueryKey`, `useSettingsQuery()`, `useSaveSettingsMutation()`, `useSessionActionMutation(onSnapshot)`

**Side effects:** toasts (pause/resume copy follows locked session strategy; includes `ackWork`); query cache updates; alert playback on action success.

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

### `ui/catalog.ts` + `ui/features/hideContinueButton.ts`

Web UI preference catalog (plain TS, no Zod).

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

## Components

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

Owns `useNow(IDLE_ESTIMATE_TICK_MS)`. Shows estimated end (locale time) and approximate duration from per-session overrides via `sessionProjection`.

### `src/components/timer/ActiveTimer.tsx`

| Props | Type |
|-------|------|
| `snapshot` | `ActiveSnapshot` |
| `onAction` | `(path: string) => void` |

Owns `useNow(ACTIVE_UI_TICK_MS)`. Derives `phase`, `params`, `pauseStrategy` from `snapshot.session`. Renders phase label, countdown, cycle, estimated end (`activeEstimatedSessionEndMs`), hint, actions, and live-stats HUD (`liveStatsAt`). `short_rest_ack` reuses decision countdown fields. `hideContinueButton` UI flag filters Continue during work decision.

Planned-work clock uses `timerFrozenAt` when set (hard pause). Pause button label and phase suffix follow `snapshot.session.pauseStrategy`.

### `src/components/SettingsTab.tsx`

| Props | Type |
|-------|------|
| `settings` | Settings |
| `onSave` | `(s: Settings) => void` |
| `locked` | boolean |
| `saving?` | boolean |

Draft includes timing fields plus `enableHardPause` (maps to `workPauseStrategy`). Sections: **Save defaults**, **Browser preferences** (UI flags), **Debug** (gated debug flags). **Experimental features** gate reveals **Enable hard pause (experimental)**; auto-opens when saved defaults use `"hard"`.

### `src/components/AboutTab.tsx`

| Export | Props |
|--------|-------|
| `AboutTab` | none (uses health query + toast) |

Internal helpers: `StatusPill`, `CreditRow`, `healthUi`, `healthClassName`, `buildDiagnostics` (not exported).

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

## CSS modules (committed)

`App.module.css`, `Nav.module.css`, `NumberField.module.css`, `TimerTab.module.css`, `SettingsTab.module.css`, `AboutTab.module.css`, `timer/timerDisplay.module.css`, `about/AboutAccordion.module.css`, `about/LinkCard.module.css`, `providers/ToastProvider.module.css`, plus global `styles.css`.

---

## Config / non-TS

Workspace manifests, Docker files, `vite.config.ts` (defines `__APP_VERSION__`, proxy), HTML shell — see [build-and-deploy.md](./build-and-deploy.md) and [structure.md](./structure.md).
