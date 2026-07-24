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
| `alertLog` | `AlertEvent[]` | Append-only until session ends |
| `alertSeq` | number | Monotonic high-water; reset to 0 after idle delivery |
| `listeners` | `Set<SnapshotListener>` | SSE subscribers |
| `listenerCursors` | `WeakMap<listener, number>` | Last delivered `alertSeq` per listener |

---

## Domain types (`@flexi-pomodoro/shared`)

### `PhaseKind`

`"planned_work" | "decision" | "extended_work" | "short_rest" | "long_rest"`

### Phase shapes

#### `PlannedWorkPhase`

| Field | Type |
|-------|------|
| `kind` | `"planned_work"` |
| `cycleIndex` | number (1-based) |
| `startedAt` | ISO string |
| `plannedDurationSec` | number |
| `plannedEndAt` | ISO string |
| `softPaused` | boolean |
| `softPausedSec` | number (accumulated) |
| `softPauseStartedAt` | ISO string \| null |

Soft pause does **not** extend `plannedEndAt`; it accumulates `softPausedSec` for analytics (M3). Soft-paused at planned end → auto rest, skip decision.

#### `DecisionPhase`

| Field | Type |
|-------|------|
| `kind` | `"decision"` |
| `cycleIndex` | number |
| `startedAt` | ISO (planned work end) |
| `decisionEndsAt` | ISO |
| `decisionWindowSec` | number |

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
