# Product Requirements Document: Flexi Pomodoro

| Field | Value |
| --- | --- |
| **Product name** | Flexi Pomodoro (working title) |
| **Document type** | Product Requirements Document (PRD) |
| **Version** | 1.0 |
| **Status** | Draft |
| **Last updated** | 2026-07-11 |
| **Audience** | Solo builders / self-hosters implementing the app |

---

## 1. Overview

### 1.1 Problem

Classic Pomodoro forces a hard stop at the end of every work block. That breaks flow: people either ignore the timer, abandon the technique, or lose deep-work momentum. Existing timers also rarely combine (a) flow-friendly work continuation, (b) strict session commitment, and (c) durable personal analytics in a simple self-hosted package.

### 1.2 Solution

A lightweight, single-user, self-hostable web app that implements a **flow-aware Pomodoro variant**:

- Configurable defaults for work, short rest, cycles-before-long-rest, and long rest.
- Per-session overrides before start.
- Alerts at every period boundary.
- Optional **extended work** after a work period ends (stay in flow) without earning a longer break.
- **Committed session runtime**: once started, the user cannot abandon the session until all planned cycles complete.
- Persistent analytics with clear personal stats.

### 1.3 Goals

| Goal | Success signal |
| --- | --- |
| Easy self-host | One Docker image + minimal config brings the app up |
| Flow without cheating breaks | Extended work is allowed; break length stays as configured |
| Commitment | Session cannot be cancelled mid-runtime; cycles auto-advance |
| Insight | Historical work/rest data is stored and surfaced as useful stats |
| Lightweight | Small image, low resource use, no mandatory external cloud services |

### 1.4 Non-goals (v1)

- Multi-user accounts, teams, or social features
- Mobile native apps (responsive web is enough)
- Cloud SaaS hosting as a product offering
- Integrations (calendar, Slack, Todoist, etc.)
- AI coaching, gamification badges, or leaderboards
- Sync across multiple devices beyond shared backend data for one user

---

## 2. Personas & use cases

### 2.1 Primary persona

**Solo knowledge worker / student** who:

- Runs apps on a homelab, VPS, or local Docker host
- Wants structure but hates being yanked out of flow
- Cares about personal history (time worked, completion rates, streaks)

### 2.2 Core use cases

1. Set personal defaults once; reuse them daily.
2. Start a committed session (optionally overriding defaults for that run).
3. Work → alert → take short rest (or continue working if in flow) → alert → next cycle, automatically.
4. After N cycles, take a long rest (skippable early); then manually start the next session when ready.
5. Review analytics: time in focus, overwork (extended) minutes, sessions completed, etc.

---

## 3. Terminology

| Term | Definition |
| --- | --- |
| **Work period** | Timed focus block within a cycle |
| **Short rest** | Break after a work period that is not the long-rest boundary |
| **Long rest** (big / extended break) | Break granted after completing the configured number of cycles in a session |
| **Cycle** | One work period + its following rest (short or long). Cycle count increments when a work period is **completed** (including if the user used extended work before resting) |
| **Extended work** | Continuation of a work period after the planned work duration ends, while the user chooses to stay in flow |
| **Session runtime** (session) | A committed run of **N cycles**, where N is the default or the session override. Starts only on explicit user action |
| **Defaults** | Persistent user settings used when starting a session without overrides |
| **Session override** | One-time values applied only to the session about to start |
| **Period boundary** | Instant when a planned work or rest duration reaches zero (triggers alert + UI state change) |

---

## 4. Functional requirements

### 4.1 Self-hosting (FR-HOST)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-HOST-1 | Ship a single Docker image that runs the full app (UI + API + data store, or clearly documented compose of app + volume) | P0 |
| FR-HOST-2 | Persist all settings, session history, and analytics across container restarts via a mounted volume | P0 |
| FR-HOST-3 | Document minimal run command / compose example (port, volume, optional env vars) | P0 |
| FR-HOST-4 | Health endpoint for orchestration (`/health` or equivalent) | P1 |
| FR-HOST-5 | Configurable listen port and base path (or reverse-proxy friendly defaults) | P1 |
| FR-HOST-6 | No mandatory third-party SaaS; optional env for timezone display only | P0 |

**Acceptance (hosting):**

- `docker run` (or `docker compose up`) with one volume exposes the UI on a published port.
- Killing and recreating the container preserves history and settings.

---

### 4.2 Settings: defaults & session overrides (FR-SET)

#### 4.2.1 Configurable defaults

Users must be able to persist:

| Setting | Description | Constraints (v1 proposal) |
| --- | --- | --- |
| Work duration | Planned focus length per cycle | Positive duration; suggested range 1–180 min |
| Short rest duration | Rest after non-final cycles | Positive duration; suggested range 1–60 min |
| Cycles before long rest (`N`) | Number of cycles in a session runtime | Integer ≥ 1; suggested range 1–12 |
| Long rest duration | Rest after the Nth cycle | Positive duration; suggested range 1–120 min |

Optional v1 niceties (P2): sound pack selection, alert volume preference, theme.

#### 4.2.2 Session overrides

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SET-1 | Before starting a session, user may override any of: work, short rest, `N`, long rest | P0 |
| FR-SET-2 | Overrides apply only to that session; defaults remain unchanged unless user saves defaults separately | P0 |
| FR-SET-3 | After session **start**, work / short rest / `N` / long rest for that session are **locked** except where rules explicitly allow early end of long rest (see FR-SESS) | P0 |
| FR-SET-4 | Long rest duration cannot be **increased** after session start (neither default edit mid-session nor in-session bump) | P0 |
| FR-SET-5 | UI clearly distinguishes “Defaults” vs “This session” | P0 |

---

### 4.3 Alerts (FR-ALERT)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ALERT-1 | At the end of every planned work period, play an audible alert | P0 |
| FR-ALERT-2 | At the end of every short rest and long rest, play an audible alert | P0 |
| FR-ALERT-3 | Alert also fires when extended work is later paused/ended and rest is about to begin (same “work finished → rest” cue, or a dedicated cue—see open questions) | P0 |
| FR-ALERT-4 | Visual alert/state change accompanies sound (phase banner, color shift, browser notification if permitted) | P1 |
| FR-ALERT-5 | User can mute/unmute alerts; mute preference persisted | P1 |
| FR-ALERT-6 | Alerts must work when the tab is in background **as far as browsers allow** (Audio unlock / Notification API documented) | P1 |

**Acceptance:** Each period boundary produces a noticeable sound without requiring a page reload.

---

### 4.4 Flow-aware work continuation (FR-FLOW)

This is the primary behavioral difference from classic Pomodoro.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-FLOW-1 | When planned work duration reaches zero, the app **alerts** and enters a **decision state**: Start rest **or** Continue working (extended work) | P0 |
| FR-FLOW-2 | If user chooses continue, the timer **keeps running** and remains labeled as work / extended work; elapsed time beyond plan is tracked separately for analytics | P0 |
| FR-FLOW-3 | User may **pause / end extended work at any time**; doing so transitions to the rest that belongs to this cycle | P0 |
| FR-FLOW-4 | Rest duration after extended work equals the **configured short rest** (or long rest if this cycle is the Nth)—**not** scaled by overtime | P0 |
| FR-FLOW-5 | Extended work does **not** advance or grant long rest early; long rest is earned only by completing `N` cycles | P0 |
| FR-FLOW-6 | Decision state should not auto-start rest without user input (avoid forcing break while user is still deciding). Timeout behavior is an open question | P0 / TBD |
| FR-FLOW-7 | UI must show planned vs elapsed vs overtime clearly during extended work | P0 |

**Cycle counting rule (normative):**

- A cycle’s work portion is **complete** when the user leaves work for rest (either immediately at the planned boundary, or after ending extended work).
- Overtime does not create extra cycles and does not change rest length.

---

### 4.5 Session runtime & cycle automation (FR-SESS)

#### 4.5.1 Starting a session

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SESS-1 | A session runtime starts **only** when the user explicitly starts it | P0 |
| FR-SESS-2 | Starting captures immutable session parameters: work, short rest, `N`, long rest (from defaults + overrides) | P0 |
| FR-SESS-3 | On start, cycle 1 work begins immediately | P0 |

#### 4.5.2 During a session

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SESS-4 | Once started, the user **cannot abort / stop / cancel** the session until all `N` cycles are finished (including their rests as defined below) | P0 |
| FR-SESS-5 | Inside a session, transitions between cycles are **automatic** after each rest completes (next work starts without requiring a new “Start session”) | P0 |
| FR-SESS-6 | User cannot increase long rest duration after start | P0 |
| FR-SESS-7 | After cycles `1 .. N-1`, rest is **short rest**; after cycle `N`, rest is **long rest** | P0 |
| FR-SESS-8 | User **may prematurely end the long rest**; this ends the session runtime and returns the app to idle (ready for a **manual** next session start) | P0 |
| FR-SESS-9 | Premature end of long rest must **not** auto-start a new session | P0 |
| FR-SESS-10 | Short rests are **not** skippable in v1 (unless open question decides otherwise)—only long rest is early-endable | P0 (assumed) |
| FR-SESS-11 | Pause during **planned** work / short rest: see open questions; pause during **extended work** is required (FR-FLOW-3) | TBD |

#### 4.5.3 Session completion

A session is **complete** when:

1. All `N` work periods have been completed (with or without extended work), and  
2. The long rest has either run to completion **or** been ended early by the user.

After completion → idle; next session requires explicit start.

#### 4.5.4 Illustrative timeline

Example: `N = 3`, work 25m, short rest 5m, long rest 15m.

```
User starts session
  Cycle 1: Work 25m → [alert] → (optional extended work) → Short rest 5m → [alert]
  Cycle 2: Work 25m → [alert] → (optional extended) → Short rest 5m → [alert]   // auto
  Cycle 3: Work 25m → [alert] → (optional extended) → Long rest 15m → [alert]
Idle (or idle immediately if user ends long rest early)
User must Start again for a new session runtime
```

---

### 4.6 Analytics (FR-AN)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AN-1 | Persist every completed work period, rest period, extended-work segment, and session | P0 |
| FR-AN-2 | Record timestamps, durations, session id, cycle index, phase type, whether overtime occurred, planned vs actual durations | P0 |
| FR-AN-3 | Dashboard shows at least: total focus time, total overtime (extended), total rest time, sessions started/completed, average cycles/session, overtime frequency | P0 |
| FR-AN-4 | Time-range filters: today / 7 days / 30 days / all (or custom range P2) | P1 |
| FR-AN-5 | Simple charts (e.g. focus minutes per day, sessions per day) | P1 |
| FR-AN-6 | Data stays local to the self-hosted instance (export JSON/CSV P2) | P0 / P2 |

**“Nice to know” stats (v1 target set):**

- Focus minutes (planned + overtime broken out)
- Overtime minutes and % of sessions/cycles that used extended work
- Rest minutes (short vs long)
- Sessions completed vs abandoned (abandon should be impossible mid-session in v1; still track incomplete only if crash/restart recovery leaves a session open—see reliability)
- Longest focus streak (consecutive days with ≥1 completed session)
- Average overtime when extended work is used

---

## 5. State machine (normative)

```
IDLE
  └─[user: Start session]→ WORK_PLANNED

WORK_PLANNED
  └─[planned work elapsed]→ WORK_BOUNDARY   // alert

WORK_BOUNDARY
  ├─[user: Start rest]→ REST_SHORT or REST_LONG   // based on cycle index vs N
  └─[user: Continue work]→ WORK_EXTENDED

WORK_EXTENDED
  └─[user: Pause / end extended work]→ REST_SHORT or REST_LONG

REST_SHORT
  └─[short rest elapsed]→ WORK_PLANNED       // next cycle, automatic; alert at boundary

REST_LONG
  ├─[long rest elapsed]→ IDLE                // session complete; alert
  └─[user: End long rest early]→ IDLE        // session complete; no auto-start
```

**Forbidden transitions (v1):**

- IDLE ← cancel from WORK_* / REST_SHORT  
- Any increase of session long-rest parameter after Start  
- REST_* → longer rest because of overtime  

---

## 6. UX requirements

### 6.1 Primary surfaces

1. **Timer / session** — dominant view: phase, countdown/count-up, cycle `k / N`, primary actions  
2. **Defaults** — edit persistent settings  
3. **Analytics** — stats and charts  
4. **About / self-host help** — link to run instructions (can be minimal)

### 6.2 Session view essentials

- Large remaining time for planned phases; clear count-up or “+overtime” during extended work  
- Cycle progress (`2 / 3`)  
- Phase label: Work / Extended work / Short rest / Long rest / Decide  
- Actions depend on state (Start; Continue work / Start rest; End extended work; End long rest early)  
- No destructive “Stop session” control while session is active  

### 6.3 Accessibility & clarity

- Color not the only phase signal  
- Keyboard-operable primary actions  
- Respect reduced-motion where reasonable  

### 6.4 Design note

Keep the UI minimal and calm; one primary composition on the timer screen. Avoid dashboard clutter on the main timer view—analytics live on their own surface.

---

## 7. Data model (logical)

### 7.1 Settings

```
Settings {
  workDurationSec: number
  shortRestDurationSec: number
  cyclesBeforeLongRest: number  // N
  longRestDurationSec: number
  alertsMuted: boolean
  // optional: soundId, theme, timezone
}
```

### 7.2 Session

```
Session {
  id: string
  startedAt: datetime
  completedAt: datetime | null
  status: "active" | "completed" | "interrupted"  // interrupted = unclean shutdown recovery
  params: {
    workDurationSec
    shortRestDurationSec
    cyclesBeforeLongRest
    longRestDurationSec
  }
}
```

### 7.3 Period events

```
Period {
  id: string
  sessionId: string
  cycleIndex: number        // 1..N
  phase: "work" | "short_rest" | "long_rest"
  plannedDurationSec: number
  startedAt: datetime
  endedAt: datetime | null
  actualDurationSec: number | null
  extendedWorkSec: number   // 0 if none; overtime after planned work
  endedReason: "completed" | "extended_then_rest" | "long_rest_skipped" | "recovery"
}
```

Exact schema may differ in implementation; fields above are the analytics contract.

---

## 8. Non-functional requirements

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| NFR-1 | Performance | Timer UI updates smoothly; server is optional for tick authenticity—see architecture assumption | P0 |
| NFR-2 | Reliability | Wall-clock based timing (not only `setInterval` drift); survive refresh via persisted session state | P0 |
| NFR-3 | Resources | Target ≤ ~256MB RAM typical for container under single-user load | P1 |
| NFR-4 | Privacy | All data local to instance; no telemetry by default | P0 |
| NFR-5 | Security | v1 may be network-open single-user; document putting behind reverse proxy / SSO / basic auth | P1 |
| NFR-6 | Browser support | Latest Chrome/Firefox/Safari; document autoplay/audio policies | P1 |
| NFR-7 | Observability | Structured logs to stdout for Docker | P2 |

---

## 9. Architecture assumptions (implementation guidance, not locked)

These are **recommendations** for a lightweight v1; final stack can change if goals are met.

| Layer | Assumption |
| --- | --- |
| Delivery | Single Docker image |
| App | Web UI + small backend API |
| DB | SQLite on mounted volume (zero external DB dependency) |
| Timing | Client displays; server stores authoritative session start + params; reconcile on load |
| Auth | None in v1 (trusted private network); optional reverse-proxy auth |

---

## 10. Docker / ops requirements

### 10.1 Expected artifacts

- `Dockerfile` producing a runnable image  
- `docker-compose.yml` example with:

  - service port mapping (e.g. `8080:8080`)  
  - named/bound volume for data  
  - optional `TZ` env  

### 10.2 Example (illustrative)

```bash
docker run -d \
  --name flexi-pomodoro \
  -p 8080:8080 \
  -v flexi-pomodoro-data:/data \
  -e TZ=Asia/Kolkata \
  ghcr.io/example/flexi-pomodoro:latest
```

### 10.3 Upgrade

- Image pull + recreate must keep `/data`  
- Migrations must be automatic on startup  

---

## 11. Edge cases & recovery

| Scenario | Expected behavior |
| --- | --- |
| Browser tab closed mid-session | Session remains active server-side; reopening resumes correct phase from wall clock |
| Container restart mid-session | Same: recompute phase from stored anchors; if phase fully elapsed while down, land on boundary/decision or next phase per rules |
| Multiple tabs | One logical session; secondary tabs reflect shared state (poll/SSE/websocket) or show “session active elsewhere” |
| Audio blocked by browser | Show persistent visual + prompt to enable sound |
| User tries to change defaults mid-session | Allow editing defaults for **future** sessions only; active session params unchanged |
| `N = 1` | Single work → long rest only (no short rest) |

---

## 12. Milestones (suggested)

| Milestone | Scope |
| --- | --- |
| **M1 – Timer core** | Defaults, session start, work/rest, alerts, flow continuation, session lock rules, Docker image |
| **M2 – Persistence & resume** | SQLite, crash/refresh recovery, multi-tab safety |
| **M3 – Analytics** | Event logging + stats UI + basic charts |
| **M4 – Polish** | Notifications, mute, export, reverse-proxy notes, PWA optional |

---

## 13. Acceptance criteria (product-level)

v1 is acceptable when all of the following hold:

1. App runs from Docker with persistent volume and no external managed DB.  
2. User can set defaults and override them per session before start.  
3. Audible alerts fire at work/rest boundaries.  
4. At work end, user can continue (extended work) and later take the **same** configured rest—not a longer one.  
5. Extended work never grants long rest early; long rest only after `N` completed cycles.  
6. After start, session cannot be stopped until `N` cycles are done; long rest can be ended early → idle; next session is manual.  
7. Within a session, cycles after the first start automatically.  
8. Analytics store history and show the v1 “nice to know” stats.

---

## 14. Open questions

Resolved answers should update this PRD and bump the version.

| # | Question | Impact | Default assumption if unanswered |
| --- | --- | --- | --- |
| Q1 | Can the user **pause** planned work or short rest (not only extended work)? | Timer controls, commitment philosophy | **No pause** during planned work/short rest in v1; only end extended work |
| Q2 | Can short rest be ended early? | Symmetry with long rest | **No** in v1—only long rest is early-endable |
| Q3 | Does WORK_BOUNDARY auto-timeout into rest if the user ignores the alert? | Flow vs structure | **No auto-rest**; wait indefinitely (with repeating gentle alert optional) |
| Q4 | Should “End extended work” be framed as Pause or as Start rest? | Copy / UX | Single action: **Start rest** (ends overtime) |
| Q5 | Auth for exposure on public VPS? | Security | Document reverse-proxy auth; no built-in auth in v1 |
| Q6 | PWA / installable / offline timer? | Scope | Not required for v1 |
| Q7 | Exact sound assets / custom upload? | Packaging | Ship 1–2 built-in alarm sounds |
| Q8 | Time units in UI: minutes only or mm:ss? | UX | Minutes for settings; mm:ss on live timer |
| Q9 | If container was down through an entire rest, skip ahead how many phases? | Recovery | Advance through completed phases by wall clock; stop at next **user decision** boundary (WORK_BOUNDARY) |
| Q10 | Product name “Flexi Pomodoro” final? | Branding | Working title only |

---

## 15. Out-of-scope backlog (post-v1)

- Tasks / project tags on sessions  
- Multi-profile on one instance  
- Built-in OIDC / basic auth  
- Sync/export to external tools  
- Adaptive durations based on analytics  
- Mobile apps  

---

## 16. Summary of the technique variant

**Classic Pomodoro:** Work ends → mandatory break; break length fixed; sessions loosely structured.

**Flexi Pomodoro:**

1. User commits to **N cycles** (session runtime)—no bailout until done.  
2. Work end → alert → **optional extended work** (flow).  
3. Break length stays as configured (short or long)—**never** stretched by overtime.  
4. Long rest only after **N** cycles; may be cut short; **does not** auto-start the next session.  
5. Only the user starts a session; cycles inside auto-chain.  
6. Everything is logged for personal analytics.  
7. Distributed as a **self-hosted Docker** app.

---

## Document history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-07-11 | Initial PRD from product brief |
