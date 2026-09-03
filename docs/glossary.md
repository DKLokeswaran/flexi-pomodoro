# Domain Glossary

Terms from shared types, APIs, UI copy, and commit messages.

## Product

| Term | Meaning |
|------|---------|
| **Flexi Pomodoro** | Self-hosted, flow-aware Pomodoro variant with decision window, extended work, and soft pause |
| **M1** | Milestone 1 — timer core (in-memory, no SQLite) |
| **M2** | Pause modules — soft and hard `WorkPauseStrategy` plugins; hard pause experimental via Settings |
| **M2.5** | Short-rest acknowledgement + in-memory live session stats on the active timer surface |
| **M3** | Persistence & analytics milestone (SQLite, decision segments, recovery) |
| **Alpha** | Current release channel (`0.0.2-alpha.*`) |
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
| **Short-rest acknowledgement (`short_rest_ack`)** | Brief window after short rest ends (same duration as work decision window). User ack → next work running; timeout → next work immediately paused (active pause strategy). Not used after long rest |
| **Long rest** | Rest when `cycleIndex >= N`; ending it completes the session |
| **Live session stats** | In-memory `SessionLiveStats` on active snapshots: `workedSec`, `deliberationSec`, `restSec` (M2.5) |
| **Estimated session end** | Client UI projection of when the session finishes. Idle: nominal path from current overrides (`N×work + (N−1)×short rest + long rest`). Active: forward remainder from phase anchors (instant acks; deliberation / extended / hard-pause slip included) |
| **Cycle index** | 1-based work cycle counter within a session |
| **Soft pause** | Pause during planned work that does **not** move `plannedEndAt`; accumulates `pausedSec`; `timerFrozenAt` stays null |
| **Hard pause** | Experimental strategy (`workPauseStrategy: "hard"`). Freezes countdown via `timerFrozenAt`; shifts `plannedEndAt` on resume. Selected in Settings → Experimental features; locked at session start |
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
| `short_rest_ack_expired` | Short-rest ack window timed out; work starts paused (M2.5) |

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
| **Debug mode** | Client gate unlocking per-feature debug flags (localStorage `flexi-pomodoro:debugFlags`) |
| **Browser preferences / UI flags** | Client-only toggles in Settings → Browser preferences (localStorage `flexi-pomodoro:uiFlags`); not sent to the server |
| **hideContinueButton** | UI flag that removes the Continue action during the work-decision phase |
| **Experimental features** | Settings UI gate; when enabled, shows **Enable hard pause (experimental)** (maps to `workPauseStrategy`) |
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
| Phase `kind` | `planned_work`, `decision`, `short_rest_ack`, `extended_work`, `short_rest`, `long_rest` |
| Feature status (About) | `available`, `soon` |
| Toast `kind` | `success`, `error` |
| Tab ids | `timer`, `settings`, `analytics`, `about` |
