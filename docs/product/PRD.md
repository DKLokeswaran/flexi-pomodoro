# Product Requirements Document: Flexi Pomodoro

| Field | Value |
| --- | --- |
| **Product name** | Flexi Pomodoro (working title — see §14 Q10) |
| **Document type** | Product Requirements Document (PRD) |
| **Version** | 1.6 |
| **Status** | Draft |
| **Last updated** | 2026-07-24 |
| **Audience** | Solo builders / self-hosters implementing the app |

---

## 1. Overview

### 1.1 Problem

Classic Pomodoro forces a hard stop at the end of every work block. That breaks flow: people either ignore the timer, abandon the technique, or lose deep-work momentum. Existing timers also rarely combine (a) flow-friendly work continuation, (b) strict session commitment, and (c) durable personal analytics in a simple self-hosted package.

### 1.2 Solution

A lightweight, single-user, self-hostable web app that implements a **flow-aware Pomodoro variant**:

- Configurable defaults for work, short rest, cycles-before-long-rest, and long rest.
- Per-session overrides before start.
- Unique audible alerts at **system-maintained** period boundaries (not on manual button presses that merely confirm intent).
- Optional **extended work** after a work period ends (stay in flow) without earning a longer break.
- Short decision window after planned work ends; silence → assume extended work.
- Short-rest **acknowledgement** window after each short rest; silence → next work starts immediately paused.
- **Committed session runtime**: once started, the user cannot abandon the session until all planned cycles complete.
- Soft-pause (default) and experimental hard-pause for **work only**, implemented as swappable modules.
- Persistent analytics with first-class extended-work metrics; live session stats while active; today totals on idle.

### 1.3 Goals

| Goal | Success signal |
| --- | --- |
| Easy self-host | One Docker image + minimal config brings the app up |
| Flow without cheating breaks | Extended work is allowed; break lengths stay as configured (never increased mid-session) |
| Commitment | Session cannot be cancelled mid-runtime; cycles auto-advance |
| Insight | Historical work/rest/extended data is stored and surfaced as useful stats |
| Lightweight | Small image, low resource use, no mandatory external cloud services |
| Removable pause strategies | Soft vs hard pause live in isolated modules; either can be deleted without surgery |

### 1.4 Non-goals (v1)

- Multi-user accounts, teams, or social features
- Built-in authentication (trusted private network / reverse-proxy only)
- Mobile native apps (responsive web is enough)
- Cloud SaaS hosting as a product offering
- Integrations (calendar, Slack, Todoist, etc.)
- AI coaching, gamification badges, or leaderboards
- Sync across multiple devices beyond shared backend data for one user
- LLM-generated alarm tones (use curated open-license samples chosen by the product owner)

---

## 2. Personas & use cases

### 2.1 Primary persona

**Solo knowledge worker / student** who:

- Runs apps on a homelab, VPS, or local Docker host
- Wants structure but hates being yanked out of flow
- Cares about personal history (time worked, extended-work patterns, completion rates)

### 2.2 Core use cases

1. Set personal defaults once; reuse them daily.
2. Start a committed session (optionally overriding defaults for that run).
3. Work → alert → short decision window → rest **or** extended work → later start rest → short-rest acknowledgement → next work (running on ack, or immediately paused if the window elapses).
4. After N cycles, take a long rest (skippable early) → idle; then manually start the next session when ready. No short-rest-style acknowledgement after long rest.
5. Soft-pause work when interrupted (default); optionally try experimental hard-pause.
6. Review analytics: focus time, extended-work duration/count, rest time, sessions completed, etc.

---

## 3. Terminology

| Term | Definition |
| --- | --- |
| **Work period** | Timed focus block within a cycle (planned portion). Capabilities: soft/hard pause (per feature flags), can enter extended work |
| **Short rest** | Break after a non-final cycle. **Not** pausable, **not** early-endable, duration **not** increasable mid-session |
| **Long rest** | Break after the Nth cycle. **Not** pausable; **may** be ended early; duration **not** increasable mid-session |
| **Cycle** | One work period + its following rest (short or long). Cycle count increments when work is left for rest (after planned work and any extended work) |
| **Extended work** | Continuation of work after planned duration + decision window resolves to “stay in flow” (explicit Continue **or** decision timeout). Tracked separately in persistence for analytics |
| **Decision state** | Brief window (default **15s**, configurable **10–20s**) after planned work ends: user may acknowledge → start applicable rest; if they do not, system enters extended work. Persistence attribution of decision elapsed time depends on exit path (see FR-FLOW-11) |
| **Short-rest acknowledgement** | Brief window after **short rest** ends (same duration setting as the work decision window: **10–20s**, default **15s**). User must acknowledge to enter the next work period running. If they do not, the next work period still starts but is **immediately paused** under the active soft/hard strategy. Does **not** apply after long rest |
| **Session runtime** (session) | A committed run of **N cycles**. Starts only on explicit user action |
| **Soft pause** (default) | Planned work **end time does not change**. The work countdown keeps running toward the original planned end; a separate accumulator tracks how long the user was soft-paused (not focusing). That interruption time is for analytics only—it does **not** buy more planned work. Soft pause ends on **manual resume**, or **automatically at planned end** (see FR-PAUSE-S7: auto-rest, skip decision) |
| **Hard pause** (experimental) | Work timer **stops**. On resume, remaining time continues and the **planned end time is shifted** by the paused duration. Behind experimental feature flag |
| **Defaults** | Persistent timing values (work, rest, `N`, decision window, etc.) used when starting a session without overrides |
| **Settings** | App UI tab/panel that hosts defaults (and related preferences) |
| **Session override** | One-time values applied only to the session about to start (shown as “This session” on the timer) |
| **System period boundary** | Instant when a **timer-driven** phase reaches its end (planned work, short rest, long rest). Triggers unique alert. Manual UI actions (e.g. End extended work, End long rest early) do **not** fire “end” alarms |

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

### 4.2 Defaults & session overrides (FR-SET)

Defaults are edited on the **Settings** tab. Session overrides appear on the timer as **This session**.

#### 4.2.1 Configurable defaults

Users must be able to persist:

| Setting | Description | Constraints (v1 proposal) |
| --- | --- | --- |
| Work duration | Planned focus length per cycle | Positive duration; suggested range 1–180 min |
| Short rest duration | Rest after non-final cycles | Positive duration; suggested range 1–60 min |
| Cycles before long rest (`N`) | Number of cycles in a session runtime | Integer ≥ 1; suggested range 1–12 |
| Long rest duration | Rest after the Nth cycle | Positive duration; suggested range 1–120 min |
| Decision window | Seconds to acknowledge rest after planned work | 10–20s (default 15s) |
| Work pause strategy | `soft` (default) or `hard` (experimental) | Single setting; `hard` is the experimental option (no separate boolean) |

Optional v1 niceties (P2): sound pack selection (from shipped curated assets), alert volume, theme.

#### 4.2.2 Session overrides

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SET-1 | Before starting a session, user may override any of: work, short rest, `N`, long rest, decision window | P0 |
| FR-SET-2 | Overrides apply only to that session; defaults remain unchanged unless the user saves defaults separately (from Settings) | P0 |
| FR-SET-3 | After session **start**, session params are locked except: early end of **long rest** only | P0 |
| FR-SET-4 | **Neither short rest nor long rest duration may be increased** after session start | P0 |
| FR-SET-5 | The session’s **planned work duration** (default or override captured at start) cannot be increased after session start. This does **not** constrain extended work, which has no fixed planned end | P0 |
| FR-SET-6 | UI clearly distinguishes **Defaults** (persistent values on the Settings tab) vs **This session** (overrides before start) | P0 |

---

### 4.3 Alerts (FR-ALERT)

Alerts exist to notify the user of **system-maintained timer events**, not of their own deliberate clicks.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ALERT-1 | At end of **planned work** → enter decision state: play unique alert `work_planned_end` | P0 |
| FR-ALERT-2 | At end of **short rest**: play unique alert `short_rest_end`, then enter **short-rest acknowledgement** (FR-ACK) | P0 |
| FR-ALERT-3 | At end of **long rest** (timer completed, not early-ended): play unique alert `long_rest_end` | P0 |
| FR-ALERT-4 | When decision window expires and system auto-enters extended work: play unique alert `extended_work_auto_start` (or reuse a distinct “still working” cue—must differ from rest-start cues) | P0 |
| FR-ALERT-5 | **Do not** play an end-of-work / transition alarm when the user manually ends extended work (they initiated it; UI state change is enough) | P0 |
| FR-ALERT-6 | **Do not** require an alarm for “End long rest early” (manual); optional quiet confirmation is fine, not an alarm | P1 |
| FR-ALERT-7 | If user explicitly acknowledges rest from decision state, play unique alert `rest_ack` (or phase-specific `short_rest_start` / `long_rest_start`) so rest entry is audibly distinct from work-end | P0 |
| FR-ALERT-8 | **Each transition type has a unique sound asset** — never one shared beep for all events | P0 |
| FR-ALERT-9 | Visual state change accompanies alerts; browser notification if permitted | P1 |
| FR-ALERT-10 | Mute preference persisted | P1 |
| FR-ALERT-11 | Document browser autoplay / audio unlock constraints | P1 |

**Sound sourcing (process, not codegen):**

- Do **not** ship LLM-synthesized tones as product defaults.
- Product owner picks free/open-license samples. Candidate libraries (verify license per file before shipping):

  | Source | Notes |
  | --- | --- |
  | [Freesound](https://freesound.org/) | Filter by CC0 / CC-BY; good for distinct UI beeps & chimes |
  | [Mixkit](https://mixkit.co/free-sound-effects/alarm/) | Free Mixkit License; alarms & notifications |
  | [Pixabay Sounds](https://pixabay.com/sound-effects/) | Pixabay content license; notification packs |
  | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 game/UI packs |
  | [OpenGameArt](https://opengameart.org/) | Various free licenses; check each asset |

- Suggested distinct cues to pick (6): planned-work-end, rest-acknowledged / short-rest-start, long-rest-start, short-rest-end, long-rest-end, extended-work-auto-enter.

**Acceptance:** Timer-driven boundaries produce unique sounds; manual End extended work does not alarm.

---

### 4.4 Phase model: asymmetric shapes (FR-SHAPE)

**Decision:** Do **not** force one shared shape across planned work, extended work, and rest. Capabilities differ enough that a single “timer phase” type invites illegal states.

| Capability | Planned work | Extended work | Short rest | Long rest | Short-rest ack |
| --- | --- | --- | --- | --- | --- |
| Soft / hard pause | Yes (modules) | **No** — only end → rest | **No** | **No** | **No** |
| Fixed planned end | Yes (wall-clock end from session params; soft pause does not move it) | **No** — theoretically unbounded until user ends | Yes | Yes | Yes (ack window) |
| Early end by user | No (runs to plan → decision) | Yes → start rest | **No** | **Yes** → idle | Ack only (or timeout → paused work) |
| System end alert | Yes (planned end) | No (manual end) | Yes → enter ack | Yes (timer complete only) | No separate end alarm required |

**Shape guidance:**

- **Short rest vs long rest:** Same rest shape is fine; the only material difference is long rest may be ended early.
- **Planned work vs extended work:** **Separate shapes** — planned work has a fixed end + pause strategies; extended work has no planned end, is not pausable, and only supports “Start rest”. Do not model them as one `WorkSegment` with a `kind` flag if that collapses policy into conditionals; prefer distinct types (e.g. `PlannedWorkPhase` / `ExtendedWorkPhase`) plus distinct persistence records.
- Shared code: low-level clock helpers only—not phase policy.

---

### 4.5 Flow-aware work continuation (FR-FLOW)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-FLOW-1 | When planned work reaches its planned end **and the user is not soft-paused**: alert `work_planned_end` and enter **decision state**. If the user **is soft-paused** at that instant, see FR-PAUSE-S7 (skip decision; auto-rest) instead | P0 |
| FR-FLOW-2 | Decision state lasts a short configurable window (**10–20s**, default **15s**) | P0 |
| FR-FLOW-3 | If user **acknowledges** → transition to applicable rest (short or long); play rest-entry alert | P0 |
| FR-FLOW-4 | If user **does not** acknowledge within the window → treat as wishing to keep flow: enter **extended work** automatically; play `extended_work_auto_start`; persist extended segment as first-class data. The full decision window is included in that extended segment (`startedAt` = decision start) | P0 |
| FR-FLOW-5 | User may also explicitly choose Continue / Extended work during the window. Runtime outcome is extended work, but decision elapsed time until the click is **not** extended work (see FR-FLOW-11); extended segment starts at the click | P0 |
| FR-FLOW-6 | During extended work, timer continues as work; UI labels overtime clearly (planned duration + extended elapsed) | P0 |
| FR-FLOW-7 | User ends extended work manually → start applicable rest **without** an end-of-extended alarm | P0 |
| FR-FLOW-8 | Rest duration after extended work equals configured short/long rest—**not** scaled by overtime | P0 |
| FR-FLOW-9 | Extended work does **not** grant long rest early; long rest only after `N` cycles | P0 |
| FR-FLOW-10 | Persistence must mark extended work distinctly (`isExtended` / `extendedWorkSec` / separate segment rows) so analytics can answer duration and frequency questions | P0 |
| FR-FLOW-11 | **Decision elapsed-time attribution (normative, M3):** (1) **Timeout** (no click) → decision window duration is part of **extended work** (include in `ExtendedWorkSegment`). (2) **Explicit Acknowledge rest** or **Continue** → persist a separate **`DecisionSegment`** for `decision.startedAt` → click time; that interval is **neither** focus/planned work, **nor** rest, **nor** extended work. Soft-pause auto-rest (FR-PAUSE-S7) skips decision entirely—no `DecisionSegment` | P0 |

**Cycle counting rule (normative):**

- Work for a cycle is complete when the user leaves work for rest (from decision ack or after ending extended work).
- Overtime does not create extra cycles and does not change rest length.

---

### 4.6 Work pause strategies (FR-PAUSE)

Applies to **planned work only**. Short rest and long rest are never pausable. Long rest may only be **ended early**.

#### 4.6.1 Soft pause (default)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PAUSE-S1 | Soft pause is the **default** work-pause behavior | P0 |
| FR-PAUSE-S2 | While soft-paused, planned work **keeps counting down**; the session stays active | P0 |
| FR-PAUSE-S3 | **Planned end time does not change.** Soft pause only accumulates `pausedSec` (time the user marked as not focusing) | P0 |
| FR-PAUSE-S4 | Soft-paused time is persisted for analytics (interruption load vs focus); it does not extend planned work | P0 |
| FR-PAUSE-S5 | Soft pause does not end the session and does not unlock mid-session cancel | P0 |
| FR-PAUSE-S6 | Soft pause is available **only during planned work**. It is not available in decision, extended work, short-rest acknowledgement, or rest | P0 |
| FR-PAUSE-S7 | **Soft pause at planned end (normative):** If planned work reaches its end while still soft-paused: (1) auto-close the soft-pause slice (count soft-paused time through planned end); (2) **skip the decision window**; (3) **automatically start** the applicable rest (short or long)—user was not focusing, so do not offer / auto-enter extended work; (4) play the usual planned-work-end and rest-entry alerts | P0 |
| FR-PAUSE-S8 | Otherwise, soft pause ends via **manual resume** (or equivalent). Soft pause does not clear by itself before planned end | P0 |

Illustrative (mid-block resume): work 25:00 from T0→T25. Soft-pause 3:00 mid-block, then resume → decision still at **T25**; `pausedSec = 180`; focused ≈ 22:00.

Illustrative (never resume): soft-pause at 40:00 of a 50:00 work block, never resume → at **T50** soft pause auto-closes, **no decision / no extended work**, auto-start applicable rest; `pausedSec` includes 40:00→50:00.

#### 4.6.2 Hard pause (experimental)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PAUSE-H1 | Hard pause is the **experimental** strategy: selected via `workPauseStrategy: "hard"` (default remains `"soft"`). No separate redundant boolean | P0 |
| FR-PAUSE-H2 | Hard pause **stops** the work countdown; on resume, remaining time continues and **planned end is shifted** by paused duration | P0 |
| FR-PAUSE-H3 | Hard-paused intervals persisted for analytics / debugging | P1 |
| FR-PAUSE-H4 | Soft and hard modules both ship; strategy setting selects which is active. Deleting either later must stay straightforward | P0 |

Illustrative: work 25:00, hard-pause 3:00 with 10:00 left → on resume still 10:00 left; planned end moves +3:00.

#### 4.6.3 Modular encapsulation (mandatory)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PAUSE-M1 | Implement soft and hard pause as **separate, encapsulated modules** (e.g. `pause/softPause.ts`, `pause/hardPause.ts`) behind a narrow interface (`WorkPauseStrategy`) | P0 |
| FR-PAUSE-M2 | Core session engine depends only on the interface; no soft/hard conditionals scattered through rest/flow/analytics | P0 |
| FR-PAUSE-M3 | Deleting either strategy later = remove module + setting option + tests for that module; no rewrite of rest/extended-work logic | P0 |
| FR-PAUSE-M4 | Single setting `workPauseStrategy: "soft" \| "hard"` selects the active module (`"soft"` default) | P0 |

Suggested interface:

```
WorkPauseStrategy {
  id: "soft" | "hard"
  onPause(phase, nowMs): void
  onResume(phase, nowMs): void
  isCountdownFrozen(phase): boolean
  onPlannedEnd(phase, plannedEndMs): "rest" | "decision"
}
```

---

### 4.7 Session runtime & cycle automation (FR-SESS)

#### 4.7.1 Starting a session

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SESS-1 | A session runtime starts **only** when the user explicitly starts it | P0 |
| FR-SESS-2 | At start, the user may apply **session overrides** (work, short rest, `N`, long rest, decision window). The **effective** params for that runtime are then locked for the rest of the session—overrides are allowed at start, not mid-runtime | P0 |
| FR-SESS-3 | On start, cycle 1 work begins immediately | P0 |

#### 4.7.2 During a session

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SESS-4 | Once started, the user **cannot abort / stop / cancel** the session until all `N` cycles are finished | P0 |
| FR-SESS-5 | Inside a session, after each short rest completes, enter **short-rest acknowledgement** (FR-ACK). Next work does **not** start running until the user acknowledges; if the acknowledgement window elapses, next work still starts but is **immediately paused** (active pause strategy) | P0 |
| FR-SESS-6 | **No rest duration** (short or long) may be increased after start | P0 |
| FR-SESS-7 | After cycles `1 .. N-1`, rest is **short rest**; after cycle `N`, rest is **long rest** | P0 |
| FR-SESS-8 | User **may prematurely end the long rest** → session complete → idle; next session is manual | P0 |
| FR-SESS-9 | Premature end of long rest must **not** auto-start a new session | P0 |
| FR-SESS-10 | Short rests are **not** skippable and **not** pausable | P0 |
| FR-SESS-11 | Long rests are **not** pausable (only early-endable) | P0 |
| FR-SESS-12 | After long rest completes (timer or early end) → **IDLE**. There is **no** short-rest acknowledgement after long rest | P0 |

#### 4.7.3 Short-rest acknowledgement (FR-ACK)

Applies only after **short rest**. Not used after long rest.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ACK-1 | When short rest reaches its planned end: play `short_rest_end` and enter **SHORT_REST_ACK** | P0 |
| FR-ACK-2 | Acknowledgement window duration uses the session’s **decision window** setting (**10–20s**, default **15s**) — same value as work decision; no separate setting in v1 | P0 |
| FR-ACK-3 | If the user **acknowledges** within the window → transition to **WORK_PLANNED** for the next cycle, **running** (not paused) | P0 |
| FR-ACK-4 | If the user **does not** acknowledge within the window → still transition to **WORK_PLANNED** for the next cycle, but **immediately paused** under the active `workPauseStrategy` (soft or hard) | P0 |
| FR-ACK-5 | SHORT_REST_ACK is **not** pausable and has no “continue / extend” action — only acknowledge (or wait for timeout → paused work) | P0 |
| FR-ACK-6 | Persistence (M3): record a **`ShortRestAckSegment`** for the window. Outcome `acknowledged` on explicit ack; outcome `timeout_paused` when the window elapses. Elapsed acknowledgement time is **neither** focus/planned work, **nor** rest, **nor** extended work, **nor** work-decision time | P0 |

#### 4.7.4 Session completion

A session is **complete** when:

1. All `N` work periods have been completed (with or without extended work), and  
2. The long rest has either run to completion **or** been ended early by the user.

After completion → idle; next session requires explicit start.

#### 4.7.5 Illustrative timeline

Example: `N = 3`, work 25m, short rest 5m, long rest 15m, decision window 15s.

```
User starts session
  Cycle 1: Work 25m
           ├─ (focusing) → [alert work_planned_end] → Decision ≤15s
           │    ├─ ack rest → Short rest 5m → [alert short_rest_end]
           │    │    → Short-rest ack ≤15s
           │    │         ├─ ack → Cycle 2 work (running)
           │    │         └─ timeout → Cycle 2 work (immediately paused)
           │    └─ timeout / continue → Extended work… → user Start rest (no end alarm)
           │       → Short rest 5m → [alert short_rest_end] → Short-rest ack → …
           └─ (still soft-paused at planned end) → skip decision → Short rest 5m (auto)
                → Short-rest ack → …
  Cycle 2: Work … → … → Short rest → Short-rest ack → …
  Cycle 3: Work … → … → Long rest 15m
           ├─ timer complete → [alert long_rest_end] → IDLE
           └─ user early end → IDLE (no alarm required)
User must Start again for a new session runtime
```

---

### 4.8 Analytics (FR-AN)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AN-1 | Persist every work period, rest period, **extended-work segment**, **decision segment** (when an explicit decision action was taken), **short-rest acknowledgement segment**, soft/hard pause slices, and session | P0 |
| FR-AN-2 | Extended work must be **explicitly labeled** in DB / volume data (not merely inferred from actual > planned) | P0 |
| FR-AN-3 | Record timestamps, durations, session id, cycle index, phase type, planned vs actual, extended flag/seconds, pause strategy used; decision rows include outcome (`ack_rest` \| `continue`); short-rest ack rows include outcome (`acknowledged` \| `timeout_paused`) | P0 |
| FR-AN-4 | Dashboard: total focus time, **extended duration**, **extended occurrence count / rate**, total rest, soft-paused time, sessions completed, avg cycles/session. Decision-segment and short-rest-ack time are **not** rolled into focus, rest, or extended totals | P0 |
| FR-AN-5 | Time-range filters: today / 7 days / 30 days / all | P1 |
| FR-AN-6 | Simple charts (focus/day, extended/day, sessions/day) | P1 |
| FR-AN-7 | Data local to instance (export JSON/CSV P2) | P0 / P2 |
| FR-AN-8 | **Live session stats (M2.5):** While a session is active, the timer/session surface shows in-memory totals for the current session: total worked time (planned focus + extended; exclude soft-paused interruption from “worked” if tracked separately), decision time, and rest time. Short-rest acknowledgement elapsed may be shown with decision time or as its own line; it must not inflate worked or rest | P0 |
| FR-AN-9 | **Idle today stats (M3.5):** On the idle / idle-adjacent session surface (before Start), show aggregated stats for the **current local day** from persisted history (at minimum: worked, rest, and decision/ack deliberation totals consistent with FR-AN-4 exclusions). Full dashboard/charts remain M4 | P0 |

**“Nice to know” stats (v1):**

- Focus minutes (planned focus vs extended broken out)
- Extended-work minutes, times used, % of cycles that extended
- Decision-segment minutes (explicit ack/continue deliberation; optional detail)
- Short-rest acknowledgement minutes (optional detail; exclude from focus/rest/extended)
- Soft-paused minutes (interruption load)
- Rest minutes (short vs long; long rest early-ended count)
- Sessions completed; streak of days with ≥1 completed session
- Average extended duration when extension happens
- Today’s totals on idle (M3.5); richer ranges/charts on analytics (M4)
---

## 5. State machine (normative)

```
IDLE
  └─[user: Start session]→ WORK_PLANNED

WORK_PLANNED
  ├─[soft/hard pause per strategy]→ WORK_PLANNED (still in work; timing per module)
  ├─[planned end AND soft-paused]→ REST_SHORT or REST_LONG
  │     // auto-close soft pause; skip decision; alerts work_planned_end + rest-entry
  └─[planned end AND not soft-paused]→ WORK_DECISION   // alert work_planned_end

WORK_DECISION  // duration: decisionWindowSec (10–20)
  ├─[user: Acknowledge rest]→ REST_SHORT or REST_LONG   // rest-entry alert; persist DecisionSegment(outcome=ack_rest)
  ├─[user: Continue / extend]→ WORK_EXTENDED            // persist DecisionSegment(outcome=continue); extended starts at click
  └─[window elapsed, no ack]→ WORK_EXTENDED             // alert extended_work_auto_start; decision window ⊂ extended segment

WORK_EXTENDED
  └─[user: Start rest]→ REST_SHORT or REST_LONG         // NO end-extended alarm

REST_SHORT   // not pausable, not early-endable
  └─[short rest elapsed]→ SHORT_REST_ACK                // alert short_rest_end

SHORT_REST_ACK  // duration: decisionWindowSec (10–20); acknowledgement only
  ├─[user: Acknowledge]→ WORK_PLANNED                   // next cycle work, running
  └─[window elapsed]→ WORK_PLANNED (immediately paused) // active soft/hard strategy; persist ShortRestAckSegment(outcome=timeout_paused)

REST_LONG    // not pausable; early-endable
  ├─[long rest elapsed]→ IDLE                           // alert long_rest_end
  └─[user: End long rest early]→ IDLE                   // no alarm required; no auto-start; no SHORT_REST_ACK
```

**Forbidden transitions (v1):**

- Cancel session to IDLE from WORK_* / REST_SHORT / SHORT_REST_ACK  
- Increase any rest (or work) duration after Start  
- Pause on REST_SHORT, REST_LONG, WORK_DECISION, WORK_EXTENDED, or SHORT_REST_ACK  
- Early-end REST_SHORT  
- Scale rest upward because of overtime  
- Soft-paused planned end → WORK_DECISION or WORK_EXTENDED (must auto-rest)  
- REST_SHORT → WORK_PLANNED without SHORT_REST_ACK  
- REST_LONG → SHORT_REST_ACK or WORK_* (long rest ends session → IDLE only)  

---

## 6. UX requirements

### 6.1 Primary surfaces

1. **Timer / session** — phase, countdown/count-up, cycle `k / N`, primary actions; idle “This session” overrides before start  
2. **Settings** — tab for defaults and related preferences (e.g. experimental flags)  
3. **Analytics** — stats and charts (extended work first-class)  
4. **About / self-host help** — run instructions; credit sound licenses  

### 6.2 Session view essentials

- Large remaining time for planned phases; clear overtime during extended work  
- Visible decision countdown (e.g. “Rest in 12s — or keep working”)  
- Visible short-rest acknowledgement countdown (e.g. “Acknowledge to start work — or work starts paused”)  
- Cycle progress (`2 / 3`)  
- Phase labels: Work / Decision / Extended work / Short rest / Short-rest ack / Long rest  
- Soft-pause control on work (default); hard-pause only if experimental flag on  
- Actions: Start; Acknowledge rest; Continue; Start rest (from extended); Acknowledge (from short-rest ack); End long rest early  
- While session active (M2.5): live session stats — worked, decision, rest  
- While idle (M3.5): today’s aggregated stats from persistence  
- No “Stop session” while active  

### 6.3 Accessibility & clarity

- Color not the only phase signal  
- Keyboard-operable primary actions  
- Respect reduced-motion where reasonable  

### 6.4 Design note

Keep the timer screen one calm composition; full analytics charts on their own surface (M4). Live session HUD and idle today totals stay on the session surface.

---

## 7. Data model (logical)

### 7.1 Settings

```
Settings {
  workDurationSec: number
  shortRestDurationSec: number
  cyclesBeforeLongRest: number  // N
  longRestDurationSec: number
  decisionWindowSec: number     // 10–20, default 15
  alertsMuted: boolean
  workPauseStrategy: "soft" | "hard"  // default "soft"; "hard" is experimental
}
```

### 7.2 Session

```
Session {
  id: string
  startedAt: datetime
  completedAt: datetime | null
  status: "active" | "completed" | "interrupted"
  params: { workDurationSec, shortRestDurationSec, cyclesBeforeLongRest, longRestDurationSec, decisionWindowSec }
  pauseStrategy: "soft" | "hard"
}
```

### 7.3 Period / segment events

**Rest:** one shared rest record shape is fine (`short_rest` | `long_rest`); early-end applies only to long.

**Work:** planned and extended are **different shapes** (not one row type with a kind switch for policy).

**Decision:** persisted only when the user takes an explicit decision action (ack or continue). Timeout does **not** create a decision row—the window is folded into extended work (FR-FLOW-11).

**Short-rest acknowledgement:** always persisted for the window (explicit ack or timeout → paused work) as `ShortRestAckSegment` (FR-ACK-6).

```
PlannedWorkSegment {
  id, sessionId, cycleIndex
  plannedDurationSec          // fixed; end not moved by soft pause
  plannedEndAt                // authoritative end (may be shifted only by hard pause)
  startedAt, endedAt
  pausedSec                   // interruption accumulator; does not change plannedEndAt under soft
  endedReason: "planned_complete" | "soft_paused_auto_rest" | "recovery"
}

DecisionSegment {
  id, sessionId, cycleIndex
  startedAt, endedAt          // decision.startedAt → explicit click time
  durationSec
  outcome: "ack_rest" | "continue"
  // Not focus, not rest, not extended — deliberation only
}

ShortRestAckSegment {
  id, sessionId, cycleIndex   // cycleIndex = cycle about to start (next work)
  startedAt, endedAt
  durationSec
  outcome: "acknowledged" | "timeout_paused"
  // Not focus, not rest, not extended, not work-decision — readiness acknowledgement only
}

ExtendedWorkSegment {
  id, sessionId, cycleIndex
  startedAt, endedAt          // no plannedDurationSec / plannedEndAt
  actualDurationSec           // unbounded until user Start rest
  endedReason: "user_start_rest" | "recovery"
  // Timeout path: startedAt = decision start (window included in duration)
  // Continue path: startedAt = click time (DecisionSegment covers pre-click window)
}

RestSegment {
  id, sessionId, cycleIndex
  kind: "short_rest" | "long_rest"
  plannedDurationSec
  startedAt, endedAt
  actualDurationSec
  endedReason: "completed" | "long_rest_skipped_early" | "recovery"
}

PauseSlice {
  id, sessionId, cycleIndex, plannedWorkSegmentId
  strategy: "soft" | "hard"
  startedAt, endedAt, durationSec
}
```

Analytics contract: sum `ExtendedWorkSegment` durations/counts for extended metrics; soft-paused time from `PlannedWorkSegment.pausedSec` / `PauseSlice`; sum `DecisionSegment` and `ShortRestAckSegment` separately (optional) and **exclude** both from focus, rest, and extended totals.

---

## 8. Non-functional requirements

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| NFR-1 | Performance | Smooth timer UI; wall-clock anchors | P0 |
| NFR-2 | Reliability | Survive refresh; recover active session from volume | P0 |
| NFR-3 | Resources | ≤ ~256MB RAM typical single-user | P1 |
| NFR-4 | Privacy | Local data; no telemetry by default | P0 |
| NFR-5 | Security | No built-in auth in scope; document reverse-proxy / network isolation | P0 |
| NFR-6 | Browser support | Latest Chrome/Firefox/Safari; document audio policies | P1 |
| NFR-7 | Observability | Structured logs to stdout | P2 |
| NFR-8 | Modularity | Pause strategies and phase policies deletable in isolation | P0 |

---

## 9. Architecture assumptions (implementation guidance, not locked)

| Layer | Assumption |
| --- | --- |
| Delivery | Single Docker image |
| App | Web UI + small backend API |
| DB | SQLite on mounted volume |
| Timing | Wall-clock anchors persisted; client renders |
| Auth | None in current scope |
| Pause | `WorkPauseStrategy` plugins; `workPauseStrategy` setting (`soft` default, `hard` experimental) |

---

## 10. Docker / ops requirements

### 10.1 Expected artifacts

- `Dockerfile`  
- `docker-compose.yml` with port, data volume, optional `TZ`  

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

- Recreate keeps `/data`  
- Automatic migrations on startup  

---

## 11. Edge cases & recovery

| Scenario | Expected behavior |
| --- | --- |
| Browser tab closed mid-session | Authoritative timing is **server/volume state**, not the tab. Closing the tab does not pause or rewrite the schedule; reopen only reattaches UI (and may need a gesture to unlock audio) |
| Container restart mid-session | **Strict wall-clock catch-up (Option A)** — see §14 Q9. Recompute phase from stored anchors as if the kitchen timer never stopped; close skipped segments with `endedReason: "recovery"` where needed |
| Multiple tabs | One logical session; sync or “active elsewhere” |
| Audio blocked | Visual + enable-sound prompt |
| Defaults edited mid-session (via Settings) | Affect future sessions only |
| `N = 1` | Work → decision → (optional extended) → long rest only |
| Decision window spans tab blur | Wall clock still counts server-side; timeout → extended work |
| Soft pause across refresh / downtime | Restore pause active flag; **planned end unchanged**; downtime while paused **counts toward** `pausedSec` until manual resume **or** planned-end auto-rest (FR-PAUSE-S7) |
| Soft pause held through planned end | Auto-close soft pause; **skip decision**; **auto-start** applicable rest (no extended work); if that rest is short, short-rest acknowledgement still applies after the rest ends |
| Short-rest acknowledgement ignored | Window elapses → next work starts **immediately paused** (active strategy) |
| Down during SHORT_REST_ACK | Strict wall-clock: if window elapsed while down → open in next WORK_PLANNED already paused (`timeout_paused`); if still inside window → restore remaining ack countdown |

---

## 12. Milestones (suggested)

| Milestone | Scope |
| --- | --- |
| **M1 – Timer core** | Separate work/rest shapes, defaults (Settings tab) + session overrides, session lock, decision window, extended work, soft pause, unique alerts (placeholders OK), Docker |
| **M2 – Pause modules** | Soft strategy default + hard strategy behind flag; encapsulation + tests for delete-ability |
| **M2.5 – Short-rest ack + live session stats** | `SHORT_REST_ACK` after short rest only (ack → running work; timeout → work immediately paused via active strategy); in-memory live session stats on the active session surface (worked, decision, rest) |
| **M3 – Persistence & resume** | SQLite, labeled extended segments, **decision-window attribution** (`DecisionSegment` vs fold-into-extended per FR-FLOW-11), `ShortRestAckSegment`, strict wall-clock recovery (Q9 Option A) including SHORT_REST_ACK |
| **M3.5 – Idle today stats** | On idle, show current-day aggregates from persisted history (FR-AN-9); precedes full analytics dashboard |
| **M4 – Analytics** | Extended/pause stats + charts (today / ranges on analytics surface) |
| **M5 – Polish** | Final sound pack (owner-picked), mute, export, proxy notes |

---

## 13. Acceptance criteria (product-level)

1. Docker + persistent volume; no managed external DB.  
2. Defaults (Settings tab) + per-session overrides (including decision window); **no rest (or work) duration increase** after start.  
3. Unique alerts on system timer boundaries; **no** alarm on manual end of extended work.  
4. Decision window 10–20s; ack → rest; timeout → extended work; extended labeled in DB. Explicit ack/continue persist a `DecisionSegment` (neither focus nor rest nor extended); timeout folds the window into extended work (FR-FLOW-11).  
5. Extended work never lengthens rest or grants long rest early.  
6. Soft pause default; hard pause experimental; both modular/removable.  
7. Short rest: no pause, no early end; after short rest → acknowledgement window (ack → running work; timeout → paused work). Long rest: no pause, early end → idle (manual next session); **no** short-rest acknowledgement after long rest.  
8. Session start user-only; cycles chain inside session via short-rest acknowledgement (not blind auto-start into running work).  
9. Analytics expose extended duration and frequency clearly; live session stats while active (M2.5); idle today stats after persistence (M3.5); full dashboard/charts (M4).  
10. No built-in auth in current scope.  
11. After container downtime, resume via **strict wall-clock catch-up** (Q9 Option A), including soft-pause downtime accumulation and SHORT_REST_ACK timeout → paused work.  
12. Soft pause held through planned end → auto-rest (skip decision / extended).

---

## 14. Open questions

Where **Decision** is filled, that is the product ruling. Where **Decision** is empty, the **Default assumption** column is accepted as final (no further clarification needed).

| # | Question | Impact | Default assumption if unanswered | Decision |
| --- | --- | --- | --- | --- |
| Q1 | Can the user **pause** planned work or short rest (not only extended work)? | Timer controls, commitment philosophy | **No pause** during planned work/short rest in v1; only end extended work | **Resolved:** planned work only. Soft pause = default (end time unchanged; track interruption). Hard pause = experimental (end time shifts). Short rest never pausable. Long rest not pausable; early-end only. Both pause strategies modular/removable |
| Q2 | Can short rest be ended early? | Symmetry with long rest | **No** in v1—only long rest is early-endable | **Resolved:** No |
| Q3 | Does WORK_BOUNDARY auto-timeout into rest if the user ignores the alert? | Flow vs structure | **No auto-rest**; wait indefinitely (with repeating gentle alert optional) | **Resolved:** Short decision window (10–20s, default 15s). Ack → rest; no ack → extended work |
| Q3a | Where is decision-window elapsed time recorded for analytics? | Persistence / analytics | Fold all decision time into work or rest | **Resolved (FR-FLOW-11):** Timeout → include full window in **extended work**. Explicit Acknowledge or Continue → separate **`DecisionSegment`** (neither focus, rest, nor extended). Soft-pause auto-rest skips decision (no segment) |
| Q4 | Should “End extended work” be framed as Pause or as Start rest? | Copy / UX | Single action: **Start rest** (ends overtime) | **Resolved:** **Start rest**; no alarm on this manual action |
| Q5 | Auth for exposure on public VPS? | Security | Document reverse-proxy auth; no built-in auth in v1 | **Resolved:** No auth in current scope |
| Q6 | PWA / installable / offline timer? | Scope | Not required for v1 | |
| Q7 | Exact sound assets / custom upload? | Packaging | Ship 1–2 built-in alarm sounds | **Resolved (process):** Owner picks free/open-license samples; **unique sound per transition**; no LLM-generated default tones |
| Q8 | Time units in UI: minutes only or mm:ss? | UX | Minutes for settings; mm:ss on live timer | |
| Q9 | If container was down through an entire rest, skip ahead how many phases? | Recovery | Advance through completed phases by wall clock; stop at next **user decision** boundary (WORK_BOUNDARY) | **Resolved:** **Option A — strict wall-clock catch-up** for all scenarios below (S1–S7). Soft-pause downtime is included in `pausedSec` |
| Q10 | Product name “Flexi Pomodoro” final? | Branding | Working title only | |

### Q9 — Recovery scenarios

When the **service/container** was down and wall time advanced, what should happen on resume? (Closing a browser tab is not the same problem if timing is server-authoritative—see §11.)

**Policy:** Option A — strict catch-up (kitchen timer never stopped). Segments closed only by recovery use `endedReason: "recovery"`.

| # | Situation | Option A — Strict catch-up | Option B — Freeze while down | Option C — Land on next decision | Decision |
| --- | --- | --- | --- | --- | --- |
| S1 | Down 2 min during a 25 min work; 10 min were left | Resume with ~8 min left | Resume with 10 min left (downtime ignored) | Same as A if still in work | **A** |
| S2 | Down 40 min; was in work with 5 min left | Work already “ended” while down → open in **decision** (or auto-extended if decision window also elapsed while down) | Still show 5 min left | Jump to decision immediately | **A** |
| S3 | Down through entire short rest | Short rest completed while down → enter **SHORT_REST_ACK** at rest-end anchor (or already timed out into next work **paused** if ack window also elapsed) | Still in short rest with original remaining | Enter next work at full planned duration running (skip leftover rest and ack) | **A** |
| S4 | Down through decision window | Per FR-FLOW-4: decision elapsed → **extended work** started at decision expiry; overtime includes downtime | Still in decision with remaining window | Enter extended work now with overtime = 0 | **A** |
| S5 | Down through most of long rest | Long rest completed → **IDLE**, session complete | Still in long rest | IDLE | **A** |
| S6 | Down during extended work | Extended work continued (overtime includes downtime) until user Start rest | Extended frozen | Keep extended; overtime only while app up | **A** |
| S7 | Down during soft pause | Soft-pause accumulator **includes** downtime until manual resume **or** planned-end auto-rest (FR-PAUSE-S7) | Soft pause frozen | — | **A** (include downtime) |
| S8 | Down during SHORT_REST_ACK | If ack window elapsed while down → open in next WORK_PLANNED **already paused** (`timeout_paused`); if still inside window → restore remaining countdown | Still in ack with original remaining | Jump to running work now | **A** |

**Why Option A:** Matches real-world elapsed time. Multi-phase catch-up is allowed when wall clock requires it; closed-over segments are marked `"recovery"`.

---

## 15. Out-of-scope backlog (post-v1)

- Tasks / project tags  
- Multi-profile / built-in OIDC  
- External integrations  
- Adaptive durations  
- Mobile apps  
- Deleting soft or hard pause after a winner is chosen (architecture already supports this)

---

## 16. Summary of the technique variant

**Classic Pomodoro:** Work ends → mandatory break; break length fixed; sessions loosely structured.

**Flexi Pomodoro:**

1. User commits to **N cycles** (session runtime)—no bailout until done.  
2. Work end → alert → short decision window → rest, or stay in flow via **extended work**.  
3. Break length stays as configured (short or long)—**never** stretched by overtime.  
4. After each **short** rest → acknowledgement window: ack → next work running; ignore → next work immediately paused (soft/hard).  
5. Long rest only after **N** cycles; may be cut short; **does not** auto-start the next session; **no** short-rest acknowledgement after long rest.  
6. Only the user starts a session; cycles inside chain through short-rest acknowledgement.  
7. Everything is logged for personal analytics (live session HUD in-session; today on idle; full analytics surface later).  
8. Distributed as a **self-hosted Docker** app.

---

## Document history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-07-11 | Initial PRD from product brief |
| 1.1 | 2026-07-12 | Flow/decision/alerts/pause modules/auth/sounds; clarifications: soft vs hard end-time semantics; planned-work lock ≠ extended; overrides at start; single pause setting; separate planned/extended shapes; open-questions Decision column; technique summary trimmed |
| 1.2 | 2026-07-12 | Q9 recovery: Option A strict wall-clock catch-up for S1–S7; soft-pause downtime included; edge cases / acceptance updated |
| 1.3 | 2026-07-12 | Soft pause through planned end: auto-close pause, skip decision, auto-transition to rest |
| 1.4 | 2026-07-16 | Settings is the tab name; Defaults vs This session labeling; session overrides include decision window |
| 1.5 | 2026-07-22 | Decision-window persistence attribution (FR-FLOW-11): timeout ⊂ extended; explicit ack/continue → DecisionSegment; M3 / analytics / data model updated |
| 1.6 | 2026-07-24 | Short-rest acknowledgement (FR-ACK / SHORT_REST_ACK); M2.5 live session stats; M3.5 idle today stats; milestones M2.5 + M3.5; recovery S8 |
