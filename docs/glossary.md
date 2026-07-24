# Domain Glossary

Terms from shared types, APIs, UI copy, and commit messages.

## Product

| Term | Meaning |
|------|---------|
| **Flexi Pomodoro** | Self-hosted, flow-aware Pomodoro variant with decision window, extended work, and soft pause |
| **M1** | Milestone 1 — timer core (in-memory, no SQLite) |
| **M2** | Later milestone — includes hard pause (experimental / soon in UI) |
| **M3** | Persistence & analytics milestone (SQLite, decision segments, recovery) |
| **Alpha** | Current release channel (`0.0.1-alpha.*`) |
| **N / cyclesBeforeLongRest** | Number of work cycles before a long rest |

## Session & phases

| Term | Meaning |
|------|---------|
| **Session** | One committed run from start until long rest completes (or early end) |
| **Idle** | No active session; snapshot `status: "idle"` |
| **Active** | Session in progress |
| **Planned work** | Timed work block with fixed `plannedEndAt` |
| **Decision window** | Short interval after planned work (default 15s, bounds 10–20) to choose rest vs continue |
| **Extended work** | Overtime after decision (timeout or explicit continue); open-ended until Start rest |
| **Short rest** | Rest after a cycle when `cycleIndex < N` |
| **Long rest** | Rest when `cycleIndex >= N`; ending it completes the session |
| **Cycle index** | 1-based work cycle counter within a session |
| **Soft pause** | Pause during planned work that does **not** move `plannedEndAt`; accumulates `softPausedSec` |
| **Hard pause** | Future pause strategy; not accepted in M1 (`workPauseStrategy` literal `"soft"` only) |
| **Wall-clock catch-up** | `tick` advances through all due phase boundaries based on real time (recovery policy) |
| **Params locked** | Session uses resolved `SessionParams` for its lifetime; settings edits apply to future sessions |

## Alerts

| AlertId | When |
|---------|------|
| `work_planned_end` | Planned work boundary reached |
| `rest_ack` | User acknowledged rest from decision |
| `short_rest_start` / `long_rest_start` | Entering rest |
| `short_rest_end` / `long_rest_end` | Rest completed |
| `extended_work_auto_start` | Decision window timed out into extended work |

| Term | Meaning |
|------|---------|
| **alertSeq** | Monotonic sequence number for alert events |
| **sinceSeq / watermark** | Client cursor; only alerts with `seq > sinceSeq` are delivered/played |
| **pendingAlerts** | Delta alert list on a snapshot |

## Settings & debug

| Term | Meaning |
|------|---------|
| **Defaults / settings** | Persistent-in-process preferences used when starting without overrides |
| **Overrides** | Per-start session param fields on POST start |
| **Debug mode** | Client gate unlocking per-feature debug flags (localStorage) |
| **shortDurations** | Debug feature allowing ≥1s work/rest/decision on **start** only |
| **alertsMuted** | Settings boolean (schema); curated mute UX still “soon” |

## API / transport

| Abbreviation | Expansion |
|--------------|-----------|
| **SSE** | Server-Sent Events (`/api/session/events`) |
| **SESSION_API** | Shared constant map of `/api/...` paths |
| **SPA** | Single-page app served from `WEB_DIST` |

## Status value cheat sheet

| Enum / union | Values |
|--------------|--------|
| Snapshot `status` | `idle`, `active` |
| Phase `kind` | `planned_work`, `decision`, `extended_work`, `short_rest`, `long_rest` |
| Feature status (About) | `available`, `soon` |
| Toast `kind` | `success`, `error` |
| Tab ids | `timer`, `settings`, `analytics`, `about` |
