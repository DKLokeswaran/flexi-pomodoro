# API Reference

All paths are defined once in `@flexi-pomodoro/shared` as `SESSION_API`. There is **no authentication** on any endpoint in committed history.

Base URL (dev): Vite proxies `/api` → `http://127.0.0.1:3847`. Production: same origin as the static app (port `3847` by default).

---

## Endpoint summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/settings` | Read defaults |
| PUT | `/api/settings` | Patch defaults |
| GET | `/api/session` | Session snapshot |
| GET | `/api/session/alert-seq` | Current alert high-water |
| GET | `/api/session/events` | SSE stream of snapshots |
| POST | `/api/session/start` | Start session |
| POST | `/api/session/ack-rest` | Decision → rest |
| POST | `/api/session/ack-work` | Short-rest ack → next-cycle planned work (running) |
| POST | `/api/session/continue` | Decision → extended work |
| POST | `/api/session/start-rest` | Extended work → rest |
| POST | `/api/session/pause` | Pause planned work (active pause strategy) |
| POST | `/api/session/resume` | Resume planned work (active pause strategy) |
| POST | `/api/session/end-long-rest` | End session early from long rest |

---

## Shared response: `SessionSnapshot`

Discriminated by `status`:

### Idle

```ts
{
  status: "idle";
  serverNow: string;      // ISO
  pendingAlerts: AlertEvent[];
  alertSeq: number;
}
```

### Active

```ts
{
  status: "active";
  serverNow: string;
  session: ActiveSession;
}
```

`ActiveSession`:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | `randomUUID()` |
| `status` | `"active"` | |
| `startedAt` | ISO string | |
| `params` | `SessionParams` | Locked for session |
| `pauseStrategy` | `"soft" \| "hard"` | Copied from `settings.workPauseStrategy` at `POST /api/session/start`; locked for the session |
| `phase` | `Phase` | See [data-model.md](./data-model.md) |
| `liveStats` | `SessionLiveStats` | In-memory session totals; snapshots include in-phase progress at `serverNow` |
| `pendingAlerts` | `AlertEvent[]` | Deltas since `sinceSeq` |
| `alertSeq` | number | High-water |

`SessionLiveStats`: `{ workedSec: number; deliberationSec: number; restSec: number; pausedSec: number }` — planned focus + extended (excl. pause interruption), decision + ack windows, rest time, and soft/hard pause interruption respectively.

`AlertEvent`: `{ seq: number; id: AlertId }`.

`AlertId` enum: `work_planned_end`, `rest_ack`, `short_rest_start`, `long_rest_start`, `short_rest_end`, `long_rest_end`, `extended_work_auto_start`, `short_rest_ack_expired`.

---

## `SessionParams` / settings fields

| Field | Type | Production bounds |
|-------|------|-------------------|
| `workDurationSec` | int | 60 … 180×60 |
| `shortRestDurationSec` | int | 60 … 60×60 |
| `cyclesBeforeLongRest` | int | 1 … 12 |
| `longRestDurationSec` | int | 60 … 120×60 |
| `decisionWindowSec` | int | 10 … 20 |

Settings additionally:

| Field | Type | Notes |
|-------|------|-------|
| `alertsMuted` | boolean | Present in schema; mute UX not fully wired in M1 UI |
| `workPauseStrategy` | `"soft" \| "hard"` | Default `"soft"`. PUT accepts either value. `POST /api/session/start` reads persisted settings and locks the chosen strategy on `ActiveSession.pauseStrategy` |

Defaults (`DEFAULT_SETTINGS`): 25×60 / 5×60 / N=4 / 15×60 / decision 15 / `alertsMuted: false` / `workPauseStrategy: "soft"`.

---

## GET `/api/health`

**Response** `200`: `{ ok: true }`

---

## GET `/api/settings`

**Response** `200`: full `Settings` object.

---

## PUT `/api/settings`

**Body**: `SettingsPatch` (partial `Settings`).

**Response** `200`: updated `Settings`.

**Errors** `400`: `{ error: string; code: "INVALID_SETTINGS" }` (Zod / `SettingsError`).

Note: settings always validate against **production** bounds (debug short durations do not relax persisted defaults).

---

## GET `/api/session`

**Query**

| Param | Type | Behavior |
|-------|------|----------|
| `sinceSeq` | string/number | If missing/0/invalid → treated as current high-water (no history replay). Else floor of positive number. |

**Response** `200`: `SessionSnapshot` (ticks engine first).

---

## GET `/api/session/alert-seq`

**Response** `200`: `{ alertSeq: number }`

---

## GET `/api/session/events` (SSE)

**Query**: same `sinceSeq` rules as GET session.

**Headers**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

**Events**:
- Initial and subsequent messages: `data: <SessionSnapshot JSON>\n\n`
- Heartbeat every 25s: `: heartbeat\n\n`

Subscribe cursor advances per listener after each send. Client disconnect unsubscribes and clears heartbeat.

---

## POST `/api/session/start`

**Body** (`StartSessionBody`): optional session param overrides + optional `debug`:

```json
{
  "workDurationSec": 1500,
  "debug": { "shortDurations": true }
}
```

- `debug` parsed with **strict** `parseDebugFlags` (unknown keys fail).
- Override bounds come from `getSettingsBounds(debug)` (e.g. mins of 1s when `shortDurations`).
- Pause strategy is **not** in the start body; it comes from persisted `settings.workPauseStrategy` at request time.

**Response** `200`: `SessionSnapshot` (active).

**Errors**
| Status | Codes | When |
|--------|-------|------|
| 400 | `INVALID_SETTINGS` | Zod / bad bounds |
| 409 | `SESSION_ACTIVE` | Session already running |

---

## Session action POSTs (no body)

All return `SessionSnapshot` on success. Mapped via `errorReply` (`apps/server/src/utils/errorReply.ts`):

| Path | Service method | Typical error codes |
|------|----------------|---------------------|
| `/api/session/ack-rest` | `ackRest` | `NO_SESSION` 409, `INVALID_PHASE` 400 |
| `/api/session/ack-work` | `ackWork` | `NO_SESSION` 409, `INVALID_PHASE` 400 (requires `short_rest_ack` phase) |
| `/api/session/continue` | `continueExtended` | same |
| `/api/session/start-rest` | `startRest` | same |
| `/api/session/pause` | `pause` | `ALREADY_PAUSED`, `INVALID_PHASE`, `NO_SESSION` |
| `/api/session/resume` | `resume` | `NOT_PAUSED`, `INVALID_PHASE`, `NO_SESSION` |
| `/api/session/end-long-rest` | `endLongRest` | `INVALID_PHASE`, `NO_SESSION` |

Status mapping in `errorReply.ts`:

| Code family | HTTP |
|-------------|------|
| `NO_SESSION`, `SESSION_ACTIVE` | 409 |
| `FORBIDDEN`, `PARAMS_LOCKED` | 403 (defined; not heavily used in M1 paths) |
| Other `SessionError` | 400 |
| `SettingsError` / Zod | 400 |

Error body shape: `{ error: string; code: string }`.

---

## GraphQL / WebSocket

Not found in committed history. Real-time uses **SSE only**.
