# Data Model

## Persistence

**Not found in committed history:** SQL schemas, migrations, ORM entities, or SQLite usage. Settings and sessions are **in-memory** on the server. Docker Compose mounts volume `flexi-pomodoro-data` at `/data` as a stub for future M3 persistence.

---

## Server runtime state

### `SettingsService`

Holds a single `Settings` object, initialized from `DEFAULT_SETTINGS`.

### `SessionService`

| Field | Type | Role |
|-------|------|------|
| `session` | `ActiveSession \| null` | Current session or idle |
| `pausePlugin` | `WorkPauseStrategy \| null` | Pause plugin resolved at start; cleared when the session ends |
| `pauseRegistry` | `PauseStrategyRegistry` | Constructor default `defaultPauseRegistry()` (`buildApp` does not inject a custom registry) |
| `alertLog` | `AlertEvent[]` | Append-only until session ends |
| `alertSeq` | number | Monotonic high-water; reset to 0 after idle delivery |
| `listeners` | `Set<SnapshotListener>` | SSE subscribers |
| `listenerCursors` | `WeakMap<listener, number>` | Last delivered `alertSeq` per listener |

---

## Domain types (`@flexi-pomodoro/shared`)

### `PhaseKind`

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

No foreign keys — single process, single active session.

---

## DTO / boundary shapes

| Name | Direction | Definition |
|------|-----------|------------|
| `Settings` / `SettingsPatch` | REST settings | Zod `SettingsSchema` / partial |
| `SessionOverrides` | start body fields | Partial `SessionParams` |
| `StartSessionBody` | POST start | Overrides + optional `debug?: DebugFlags` |
| `DebugFlags` | start body | Optional booleans per `DebugFeatureId`; strict object |
| `SessionSnapshot` | REST + SSE | Idle or Active union |
| `{ alertSeq }` | GET alert-seq | number |
| `{ ok: true }` | health | |
| `{ error, code }` | error responses | |

---

## ORM / query patterns

Not found in committed history.

## Migration history

Not found in committed history.
