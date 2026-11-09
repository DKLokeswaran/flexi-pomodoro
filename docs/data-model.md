# Data Model

## Persistence

SQLite via Knex + `better-sqlite3`. File: `flexi-pomodoro.sqlite3` under the resolved data directory (`DATA_DIR`, else `/data` in production, else `./data` in dev). Migrations run on `openDatabase()`.

**Live today:**

- Singleton `settings` row (seeded from `DEFAULT_SETTINGS` on first boot; updated on every successful `PUT /api/settings`).
- Session write-through: `sessions`, `session_runtime`, `phases` + detail tables, `pause_slices` updated on every engine transition (FR-FLOW-11 / FR-ACK-6 attribution rules).
- Boot hydrate from `session_runtime` + open phase rows; one recovery tick closes overdue phases with `endedReason: "recovery"`. Corrupt/inconsistent runtime marks the session `interrupted`, clears runtime, and surfaces `recoveryAbandonedMessage` on the idle snapshot.

Docker Compose sets `DATA_DIR=/data` and mounts `${FPMD_DATA_DIR:-flexi-pomodoro-data}:/data`.

---

## Server runtime state

### `SettingsService`

Holds a cached `Settings` object. Constructed with a `SettingsStore`; `hydrate()` loads or seeds the singleton row. `update()` validates, writes through the store, then returns a copy.

### `SessionService`

| Field | Type | Role |
|-------|------|------|
| `session` | `ActiveSession \| null` | Current session or idle |
| `pausePlugin` | `WorkPauseStrategy \| null` | Pause plugin resolved at start; cleared when the session ends |
| `stores` | `SessionServiceStores` | `{ session: SessionStore; phases: PhasesStore }` (required) |
| `pauseRegistry` | `PauseStrategyRegistry` | Constructor default `defaultPauseRegistry()` |
| `alertLog` | `AlertEvent[]` | Append-only until session ends |
| `alertSeq` | number | Monotonic high-water; reset to 0 after idle delivery |
| `listeners` | `Set<SnapshotListener>` | SSE subscribers |
| `listenerCursors` | `WeakMap<listener, number>` | Last delivered `alertSeq` per listener |
| `currentPhaseId` | `string \| null` | Open `phases.id` for the in-memory current phase |
| `openPauseSliceId` | `string \| null` | Open `pause_slices.id` while paused |

---

## Domain types (`@flexi-pomodoro/shared`)

### Phase kinds (`Phase["kind"]`)

`"planned_work" | "decision" | "short_rest_ack" | "extended_work" | "short_rest" | "long_rest"`

`short_rest_ack` shares the `DecisionPhase` shape (ack window after short rest only). Long rest never enters this phase.

### Phase shapes

#### `PlannedWorkPhase`

| Field | Type |
|-------|------|
| `kind` | `"planned_work"` |
| `cycleIndex` | number (1-based) |
| `startedAt` | ISO string |
| `plannedDurationSec` | number |
| `plannedEndAt` | ISO string |
| `paused` | boolean |
| `pausedSec` | number (accumulated interruption) |
| `pauseStartedAt` | ISO string \| null |
| `timerFrozenAt` | ISO string \| null (hard: freeze clock at pause start; soft: always null) |

Soft pause does **not** extend `plannedEndAt`; it accumulates `pausedSec` for analytics (M3). Soft-paused at planned end → auto rest, skip decision. Hard pause sets `timerFrozenAt` while paused, shifts `plannedEndAt` on resume, and skips planned-end ticks until unpaused.

#### `DecisionPhase`

| Field | Type |
|-------|------|
| `kind` | `"decision" \| "short_rest_ack"` |
| `cycleIndex` | number |
| `startedAt` | ISO (planned work end, or short rest end for ack) |
| `decisionEndsAt` | ISO |
| `decisionWindowSec` | number |

Work decision (`kind: "decision"`) follows planned work. Short-rest ack (`kind: "short_rest_ack"`) follows short rest only (FR-ACK; M2.5).

#### `SessionLiveStats` (on `ActiveSession`)

| Field | Type | Role |
|-------|------|------|
| `workedSec` | number | Planned focus + extended work; pause interruption excluded |
| `deliberationSec` | number | Work-decision elapsed (explicit act only) + ack elapsed (always) |
| `restSec` | number | Short rest + long rest time |
| `pausedSec` | number | Soft/hard pause interruption (committed closed slices + open pause elapsed) |

Present on every active session snapshot; initialized to zeros at start. The engine commits phase totals on transitions and overlays in-phase progress in `buildSnapshot` via `liveStatsWithProgress`. Work-decision timeout does not commit `decisionWindowSec` on its own: extended work starts at decision start (FR-FLOW-11), so the overlay (and later `startRest` commit) attributes the window once under `workedSec`. Explicit ack/continue and ack-window time go to `deliberationSec`. Planned-work focus is wall elapsed minus total paused time (`plannedWorkSecAt`); pause duration uses the same wall-clock open-slice math (`pausedSecAt`) for soft and hard. Both helpers live in `@flexi-pomodoro/shared` (`liveStatsProgress.ts`). On planned-work end, `commitPlannedWork` commits both `workedSec` and `pausedSec`.

#### `ExtendedWorkPhase`

| Field | Type |
|-------|------|
| `kind` | `"extended_work"` |
| `cycleIndex` | number |
| `startedAt` | ISO — click time on continue; decision start on timeout |

#### `RestPhase`

| Field | Type |
|-------|------|
| `kind` | `"short_rest" \| "long_rest"` |
| `cycleIndex` | number |
| `startedAt` | ISO |
| `plannedDurationSec` | number |
| `plannedEndAt` | ISO |

Rest kind: `cycleIndex >= cyclesBeforeLongRest` → `long_rest`, else `short_rest`.

### `SessionStatus`

On snapshots: `"idle" | "active"`. Type also declares `"completed"` but snapshots collapse completion to idle (`session = null`).

### Relationships (conceptual)

```
Settings ──resolve──► SessionParams ──locked in──► ActiveSession
ActiveSession 1──1 Phase (current)
ActiveSession 1──* AlertEvent (via alertLog / pendingAlerts)
```

Runtime session state is single-process / single active session (served from memory after boot hydrate). The SQLite schema uses class-table inheritance for phases (`phases` + per-kind detail tables) with FK links for `session_runtime` / `pause_slices`. Decision timeout deletes the decision row and opens extended work from decision start (FR-FLOW-11).

---

## DTO / boundary shapes

| Name | Direction | Definition |
|------|-----------|------------|
| `Settings` / `SettingsPatch` | REST settings | Zod `SettingsSchema` / `Partial<Settings>` (session params + `alertsMuted` + `workPauseStrategy` + IANA `timezone`) |
| `SessionOverrides` | start body fields | Partial `SessionParams` |
| `StartSessionBody` | POST start | Overrides + optional `debug?: DebugFlags` |
| `DebugFlags` | start body | Optional booleans per `DebugFeatureId`; strict object |
| `SessionSnapshot` | REST + SSE | Idle or Active union; idle may include `recoveryAbandonedMessage` |
| `TodayStats` / `TodayStatsResponse` | Analytics today | Alias of `SessionLiveStats` + `clientDate` / `dayStart` / `dayEnd` |
| `{ alertSeq }` | GET alert-seq | number |
| `{ ok: true }` | health | |
| `{ error, code }` | error responses | |

---

## ORM / query patterns

Knex query builder over `better-sqlite3`. No ORM entities. Stores wrap table access:

- `SettingsStore`: `load` / `save` / `ensureSeeded`
- `SessionStore`: `transaction`, `insertSession`, `upsertRuntime`, `updateRuntimeStats`, `finalizeSession`, `clearRuntime`, `getRuntime`, `getSession`, `markInterrupted`
- `PhasesStore`: open/complete per kind, `deleteDecisionPhase`, pause slice open/close, `get*` loaders + `getOpenPauseSliceId` for hydrate, list helpers for tests
- `AnalyticsStore`: closed overlapping phase/slice lists for a day window; `daily_stats` upsert/get; earliest closed-phase start for finalize backfill

### `AnalyticsService`

Reads `settings.timezone`, computes client-timezone day bounds via Luxon helpers (`clientDay`), overlap-clips closed phases into `TodayStats`, and can finalize past days into `daily_stats` (`finalizeDueDays`). Kept out of `SessionService`.

## SQLite tables (initial migration)

| Table | Role |
|-------|------|
| `settings` | Singleton row `id=1`; all `Settings` fields + `updatedAt` |
| `sessions` | Session header + locked params |
| `phases` | Phase id + kind |
| `planned_work` / `decision` / `short_rest_ack` / `extended_work` / `rest` | Per-kind detail (FK → `phases`, `sessions`) |
| `session_runtime` | Current phase id, liveStats counters, `alertSeq` |
| `pause_slices` | Soft/hard pause intervals linked to planned work |

### Later tables

| Table | Role |
|-------|------|
| `daily_stats` | Materialized completed client-timezone days (`clientDate` PK, `dayStart`/`dayEnd`, live-stats totals, `finalizedAt`) for M3.5 / M4 |

## Migration history

| Migration | Purpose |
|-----------|---------|
| `20260909134105_initial_schema` | Creates the tables above |
| `20261109143000_settings_timezone` | Adds `settings.timezone` (IANA, not null, default `UTC`) for analytics local-day bounds (M3.5 / FR-AN-9) |
| `20261109180000_daily_stats` | Creates `daily_stats` for finalized client-timezone day aggregates |
