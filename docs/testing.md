# Testing Strategy

## Framework stack

| Piece | Choice |
|-------|--------|
| Runner | Node.js built-in `node:test` via `tsx --test` |
| Assertions | `node:assert/strict` |
| Mocking library | None added; `node:test` `mock.timers` freezes `Date` / `setInterval` where a test needs a clock (tests otherwise construct real services / fabricated snapshots) |
| Coverage tooling | Not found in committed scripts |
| E2E / browser | Not found |

**Scripts:**

| Package | Script |
|---------|--------|
| Root | `npm test` → server then web |
| `@flexi-pomodoro/server` | `tsx --test src/tests/**/*.test.ts` |
| `@flexi-pomodoro/web` | `tsx --test src/tests/**/*.test.ts` |

Server and web `tsconfig.json` files **exclude** `src/tests/**` from production typecheck/build (tests run via tsx only).

---

## Test types present

| Type | Present? |
|------|----------|
| Unit (server services, pause plugins, settings validation) | Yes |
| Unit (web projection / liveStats / todayStats / dialProgress / time / alert helpers) | Yes |
| Integration (HTTP Fastify inject; SSE over a real local socket) | Yes |
| Integration (`buildApp` boot wiring on a temp `DATA_DIR`) | Yes |
| Component render (`react-dom/server` markup, no DOM library) | Yes — `ActiveTimer` only; click handling and other components are not covered |
| E2E / browser | Not found |
| Snapshot tests | Not found |
| Contract tests | Not found |

---

## Inventory

### `apps/server/src/tests/services/session.service.test.ts`

Helpers: `servicesWithShortTimers` (via `createMockSessionStores` + mock settings), `startSession`, `activePhase`, `alertsSince`, `reachShortRestAck`, `liveStatsAt`, `snapshotAt`; fixed clock `SESSION_START_MS = 2026-07-12T10:00:00.000Z`. Engine tests that advance time call `tickIfIdle` before `getSnapshot`.

| Case | Asserts |
|------|---------|
| Happy path N=2 | work → decision → ack short rest → short_rest_ack → ackWork → work → long rest → idle; alerts; alertSeq reset |
| Alert seq reset | New session alerts restart at seq 1 |
| Decision timeout | → extended with backdated `startedAt`; startRest without replaying auto-start in pending |
| Decision timeout liveStats | Folded window counted once under `workedSec` (at timeout and after further extended / startRest) |
| Continue | Extended `startedAt` = click time |
| Soft pause mid-work | `plannedEndAt` unchanged; `pausedSec` accumulates; `timerFrozenAt` stays null |
| Soft pause liveStats | `pausedSec` grows during pause; commits after resume / planned-work end; worked holds at pause start |
| Soft-paused through end | Auto rest; skip decision |
| Hard pause 3s with 10s left | Remaining time unchanged; `plannedEndAt` shifted +3s |
| Hard pause liveStats | `pausedSec` grows while countdown frozen; commits after resume; worked holds |
| Hard-paused past original end | Stays in planned work while frozen |
| Pause/resume outside planned work (FR-PAUSE-S6) | `INVALID_PHASE` in decision, short_rest_ack, extended, short rest, long rest |
| N=1 | Long rest after first work path |
| Tick catch-up | Past work+decision → extended in one idle tick |
| shortDurations debug | Allows 1s params |
| Rejects 1s without flag | `SettingsError` / `INVALID_SETTINGS` |
| Explicit ackWork (soft) | Cycle-2 `planned_work` running; `timerFrozenAt` null |
| Explicit ackWork (hard) | Cycle-2 `planned_work` running; no freeze |
| Ack timeout (soft) | Cycle-2 paused; `timerFrozenAt` null; `short_rest_ack_expired` fires |
| Ack timeout (hard) | Cycle-2 paused; `timerFrozenAt` set; `short_rest_ack_expired` fires |
| Long rest end | Idle; never enters `short_rest_ack` |
| Pause/resume during short_rest_ack | `INVALID_PHASE` |
| Work-decision explicit act liveStats | Elapsed to click in `deliberationSec`; planned work in `workedSec` |
| ackWork explicit act liveStats | Decision + ack elapsed in `deliberationSec` |
| Ack timeout liveStats | Full ack window in `deliberationSec` |
| Live stats full cycle | Worked excludes soft pause; deliberation + rest + `pausedSec` match timeline |
| getSnapshot pure read | Overdue clock without tick keeps planned_work; after `tickIfIdle` → decision |
| tickIfIdle skip-if-busy | Concurrent `tickIfIdle` calls: at least one returns `false` |
| Long rest length | Long rest keeps `longRestDurationSec`; still running when a short rest would have ended |
| `rest_ack` alert | `ackRest` emits `rest_ack` then the rest-start alert |
| Pause when already paused | `ALREADY_PAUSED`; the open pause keeps its start |
| Resume when not paused | `NOT_PAUSED` |
| Start while active | `SESSION_ACTIVE`; the running session is kept |
| Any action with no session | `NO_SESSION` for all seven actions |
| Subscriber push after commands | One snapshot per command across a whole session, ending idle |
| Subscriber push after tick | No push when nothing is due; phase change pushes the snapshot with its alerts |
| Unsubscribe | No further pushes |
| Open-phase deliberation | `deliberationSec` grows inside decision and short-rest ack windows |
| Open-phase rest | `restSec` grows inside a rest and stops at its planned end |

### `apps/server/src/tests/services/settings.service.test.ts`

Imports parsers from `utils/settingsValidation.ts`.

| Suite | Cases |
|-------|-------|
| `parseStartSessionBody` | Accepts 1s with flag; rejects 1s without; rejects unknown debug keys (`ZodError`) |
| `SettingsService` | Hydrate from store; accept `workPauseStrategy: "hard"`; reject bad cycles / 1s work; accept valid IANA `timezone`; reject invalid IANA; `update` calls `store.save`; load existing row on hydrate |

### `apps/server/src/tests/db/settingsStore.test.ts`

Uses temp `DATA_DIR` via `openDatabase(tempDir)`.

| Case | Asserts |
|------|---------|
| `ensureSeeded` | Writes `DEFAULT_SETTINGS` once; second call returns same |
| save / load | Round-trip across process reopen (incl. `timezone`) |
| initial migration | Expected tables present (`settings`, `sessions`, `phases`, detail tables, `pause_slices`, `daily_stats`, …); `stores.analytics` present |

### `apps/server/src/tests/db/analyticsStore.test.ts`

Uses temp migrated SQLite.

| Case | Asserts |
|------|---------|
| upsert / get | Idempotent `upsertDailyStats`; `getDailyStats` / `getLatestFinalizedClientDate` |

### `apps/server/src/tests/db/sessionStore.test.ts`

Uses `openTempDatabase()`.

| Case | Asserts |
|------|---------|
| insert / upsert / updateRuntimeStats | Session + runtime round-trip (phase id, liveStats, alertSeq) |
| finalizeSession / clearRuntime | Status `completed` + `completedAt`; runtime table empty |

### `apps/server/src/tests/db/phasesStore.test.ts`

SQLite attribution checks (FR-FLOW-11 / FR-ACK-6) via store APIs (not through `SessionService`).

| Case | Asserts |
|------|---------|
| `deleteDecisionPhase` | Decision + phases rows removed; extended opened from decision start |
| `completeDecision` ack_rest | Outcome + duration; open rest |
| `completeDecision` continue | Outcome `continue`; extended `startedAt` = click |
| soft_paused_auto_rest | Planned work ended reason + closed pause slice |
| short_rest_ack outcomes | `acknowledged` vs `timeout_paused` |
| `completeRest` | `completed` vs `long_rest_skipped_early` + `actualDurationSec` |

### `apps/server/src/tests/services/session.attribution.test.ts`

Engine + real SQLite: segment rows after live transitions (FR-FLOW-11 / FR-ACK-6).

| Case | Asserts |
|------|---------|
| Decision timeout | Decision row deleted; extended opened from decision start |
| `continueExtended` | Closed decision `continue`; extended `startedAt` = click |
| `ackRest` | Closed decision `ack_rest`; short rest open |
| Soft-paused through planned end | Auto-rest; no decision row |
| short_rest_ack timeout | `timeout_paused`; next work paused |
| short_rest_ack `ackWork` | `acknowledged`; next work running |
| Early end long rest | `long_rest_skipped_early` |

### `apps/server/src/tests/services/session.recovery.test.ts`

| Case | Asserts |
|------|---------|
| Mid planned work hydrate | Restores phase without advancing |
| alertSeq restore | Runtime `alertSeq` rebuilt |
| Recovery past planned end | Work closed with `endedReason: "recovery"` |
| recoveryTick flag reset | Later closes use live endedReason |
| Session complete | Clears `session_runtime` |
| Soft-paused hydrate | Open pause slice restored |
| Hard-paused recovery | Does not advance past original planned end while frozen |
| Hard ack timeout + long downtime | Stays frozen planned_work past next planned end |
| Idle hydrate | Returns `false` when no runtime |
| CORRUPT_RUNTIME abandon | Clears runtime; idle `recoveryAbandonedMessage` |

### `apps/server/src/tests/services/session.recovery.matrix.test.ts`

Q9 Option A recovery scenarios via hydrate + `runRecoveryTick` on temp SQLite.

| Case | Asserts |
|------|---------|
| S3 | Through short rest → short_rest_ack (still in window) |
| S5 | Through long rest end → idle session complete |
| S6 | During extended → still extended; overtime includes downtime |
| S7 | Soft-pause downtime included in `pausedSec` |
| S8a | SHORT_REST_ACK inside window → restore ack |
| S8b | SHORT_REST_ACK past window → `timeout_paused` row; cycle-2 work paused from window end; deliberation + paused totals |
| Totals after restart | Worked, deliberation, rest and paused totals all restored |
| Timings after restart | `params` unchanged; the next short rest keeps its own length |
| Down from planned work past decision window | Extended work starts at planned end (snapshot, worked total, `extended_work` row) |
| Down during decision past its end | Same, from a restored decision row |

### `apps/server/src/tests/services/settings.service.persist.test.ts`

| Case | Asserts |
|------|---------|
| Restart round-trip | New `SettingsService` + same DB loads saved settings via `hydrate` |

### `apps/server/src/tests/helpers/mockSettingsStore.ts`

In-memory `SettingsStore` double for service unit tests (`load` / `save` / `ensureSeeded` + optional `saves` spy).

### `apps/server/src/tests/helpers/mockSessionStores.ts`

`createMockSessionStores()` — in-memory `SessionStore` + `PhasesStore` for `SessionService` unit tests (no SQLite).

### `apps/server/src/tests/helpers/routesApp.ts`

`openRoutesApp()` — Fastify instance with every route registered over mock settings + session stores and short session timings.

### `apps/server/src/tests/helpers/tempDatabase.ts`

`openTempDatabase()` — migrated temp SQLite dir + `AppStores` + `dispose()` for store integration tests.

### `apps/server/src/tests/pause/softPause.test.ts`

Isolated `softPauseStrategy` unit tests (no `SessionService`):

| Case | Asserts |
|------|---------|
| `onPause` | Sets flags; `timerFrozenAt` null; `plannedEndAt` unchanged |
| `onResume` | Accumulates `pausedSec`; `plannedEndAt` unchanged |
| `onPlannedEnd` while paused | → `"rest"`; closes slice through planned end |

### `apps/server/src/tests/pause/hardPause.test.ts`

Isolated `hardPauseStrategy` unit tests:

| Case | Asserts |
|------|---------|
| `onPause` | Sets `timerFrozenAt`; `isCountdownFrozen` true |
| `onResume` | Remaining time unchanged; `plannedEndAt` shifted by paused duration |

### `apps/server/src/tests/utils/asyncMutex.test.ts`

| Case | Asserts |
|------|---------|
| `runExclusive` | Overlapping work runs serially (FIFO) |
| `tryRunExclusive` | Returns `null` / skips while locked |

### `apps/server/src/tests/utils/clientDay.test.ts`

| Case | Asserts |
|------|---------|
| `clientDateAt` / `dayBoundsIso` | Client-timezone calendar date and half-open UTC window |
| `addClientDays` | Calendar-day arithmetic |
| `overlapSecFromIso` | Shared helper clips ISO intervals to the day window |
| Daylight saving (America/New_York) | 23-hour and 25-hour day bounds; clock-change days meet their neighbours with no gap or overlap |

### `apps/server/src/tests/services/analytics.service.test.ts`

| Case | Asserts |
|------|---------|
| `dayStats` | Returns `clientDate` bounds + closed-phase aggregates (incl. pause subtraction from worked) |
| full in-day phase | Attributes full worked / deliberation / rest for phases entirely inside the day |
| midnight-spanning | Splits / clips phases across adjacent client days |
| `todayStats` | Matches `dayStats` for the current client date |
| `finalizeDueDays` | Backfills missing `daily_stats` through yesterday; leaves today open |

### `apps/server/src/tests/routes/analytics.routes.test.ts`

| Case | Asserts |
|------|---------|
| GET today | Returns `todayStats()` body; day query params ignored |

### `apps/server/src/tests/routes/session.routes.test.ts`

All routes registered through `openRoutesApp()` (in-memory stores); `mock.timers` freezes `Date` for the REST cases. The SSE cases listen on a local port and read the stream over real HTTP.

| Case | Asserts |
|------|---------|
| POST start | Saved settings and saved pause strategy drive the new session |
| POST start overrides | Body overrides applied; out-of-range override → 400 `INVALID_SETTINGS` |
| Action routes | start, pause, resume, continue, start-rest, ack-work, ack-rest, end-long-rest each run their own action through a whole session |
| Rejections | `NO_SESSION` / `SESSION_ACTIVE` → 409; `NOT_PAUSED` / `ALREADY_PAUSED` / `INVALID_PHASE` → 400 |
| GET session / alert-seq | Idle and active bodies; no watermark replays nothing; `sinceSeq` selects the alert delta |
| SSE stream | Current snapshot on connect, then one frame per command and per phase-changing tick (with alerts) |
| SSE disconnect | A closed stream receives no further frames; other streams keep receiving |

### `apps/server/src/tests/routes/settings.routes.test.ts`

| Case | Asserts |
|------|---------|
| GET health | `{ ok: true }` |
| PUT / GET settings | Patch saved and returned |
| PUT invalid | 400 `INVALID_SETTINGS`; stored values unchanged |

### `apps/server/src/tests/app/app.test.ts`

Boots the real `buildApp()` against a temp `DATA_DIR` with `Date` and `setInterval` mocked; closing and re-booting the app stands in for a process restart.

| Case | Asserts |
|------|---------|
| Restart mid-session | Same session id resumes in `planned_work` with its worked time |
| Catch-up at boot | Phase that ended while down is closed with `endedReason: "recovery"` |
| Scheduler wiring | A scheduler tick advances the session with no request |
| Day finalization | Yesterday finalized at boot; the day that ends while running is finalized on rollover |

### `apps/server/src/tests/app/scheduler.test.ts`

| Case | Asserts |
|------|---------|
| Before start | No ticks |
| Ticking | One `onTick` per interval with the injected clock |
| Double start | Tick rate unchanged |
| Stop / restart | Ticks stop, then resume |

### `apps/web/src/tests/utils/liveStats.test.ts`

| Case | Asserts |
|------|---------|
| Soft pause | `pausedSec` grows with wall clock; `workedSec` holds at pause start |
| Hard pause | Same paused growth; worked holds while `timerFrozenAt` set |
| Running planned work | `workedSec` ticks locally; `pausedSec` holds |
| Decision / short-rest ack | `deliberationSec` ticks on top of earlier totals |
| Extended work | `workedSec` ticks with overtime |
| Short / long rest | `restSec` ticks and stops at the planned end |

### `apps/web/src/tests/utils/sessionProjection.test.ts`

| Case | Asserts |
|------|---------|
| Nominal duration N=2 / N=1 | Work + short rests + long rest arithmetic |

### `apps/web/src/tests/utils/activeSessionProjection.test.ts`

Fabricated `ActiveSnapshot` fixtures only (no server imports).

| Case | Asserts |
|------|---------|
| Planned work happy path | Matches idle nominal end |
| Decision / extended | End advances with wall clock |
| Extended → rest | Slip persists via rest anchors |
| Hard pause open / resume | Open pause adds time; shifted `plannedEndAt` keeps it after resume |
| Short rest after deliberation | Anchor slip reflected |
| 4-cycle session | Every remaining short rest counted (from work and from a mid-session short rest) |
| Long rest | Projected end is the long rest's planned end |
| Short-rest ack window | Remaining = next cycles + long rest |

### `apps/web/src/tests/utils/dialProgress.test.ts`

| Case | Asserts |
|------|---------|
| Planned work remaining | Arc fraction shrinks with elapsed planned time |
| Hard-pause freeze | Progress holds while `timerFrozenAt` is set |
| Extended overtime | `remaining` stays 1; `overtimeLaps` grows in work-duration units |
| `cycleDotStates` | Earlier cycles done, current live, later pending |

### `apps/web/src/tests/utils/seedTimezone.test.ts`

Uses an in-memory `localStorage` stand-in (no browser globals).

| Case | Asserts |
|------|---------|
| First visit with UTC defaults | PUTs browser IANA once (no-op save when browser is already UTC); sets `TZ_SEEDED_KEY`; later calls are gated |
| Non-UTC stored timezone | Does not overwrite; still sets the gate |

### `apps/web/src/tests/utils/todayStats.test.ts`

| Case | Asserts |
|------|---------|
| `openPhaseProgressClippedToDay` | Clips open planned work / other phases to the day window; pause handling |
| `todayDisplayStats` | Adds open-phase clip onto closed server today totals |
| Open extended work | Counted as worked, clipped to the day start |
| Open rest past planned end | Stops at the planned end |
| Open short-rest ack | Counted as deliberation |
| Pre-midnight pause | Not subtracted from today's worked time |

### `apps/web/src/tests/utils/time.test.ts`

| Case | Asserts |
|------|---------|
| `formatMmSs` / `formatHhMmSs` | Padding; minutes past one hour; switch to `hh:mm:ss` |
| `secFromIso` / `remainingSecFromIso` / `elapsedFromIso` | Whole-second arithmetic, sign and zero floors |
| `minutesToSec` / `secToMinutes` | Conversions and rounding |

### `apps/web/src/tests/utils/playAlerts.test.ts`

Installs `localStorage` and `Audio` stand-ins before importing the alert modules (singleton watermark store).

| Case | Asserts |
|------|---------|
| New alerts | Each alert's own sound, in order; watermark stored |
| Repeated delivery | Alerts arriving again (action response, then SSE) are not replayed |
| Partial overlap | Only alerts newer than the watermark play |
| New session | Alerts play again after the watermark syncs back to zero |
| Watermark helpers | `advance` is monotonic; `sinceSeqQueryString`; `alertsFromSnapshot` for idle and active |

### `apps/web/src/tests/components/ActiveTimer.test.ts`

Renders `ActiveTimer` with `renderToStaticMarkup` under `QueryClientProvider` + `UiFlagsProvider`; `Date` is frozen. A `.ts` file using `createElement`, so the test glob picks it up.

| Case | Asserts |
|------|---------|
| Actions per phase | Exact button list for every phase and both pause strategies |
| Hide Continue preference | Decision shows only Acknowledge rest |
| Running work | Countdown, cycle, estimated end, live worked total |
| Paused work | Pause label; phase end shows `Paused` |
| Extended work | Planned length + overtime; open end; hint |
| Decision | Hint with time left |
| Today row | Server closed totals + open phase |

### `apps/web/src/tests/helpers/`

`activeSnapshot.ts` — `buildActiveSnapshot()` fabricates an `ActiveSnapshot` around one phase. `browserGlobals.ts` — in-memory `localStorage` and a recording `Audio` stand-in.

---

## Mocking patterns

Settings unit tests inject `createMockSettingsStore()`. `SessionService` tests inject `createMockSessionStores()` (no SQLite) with deterministic `nowMs`. Store tests use `openTempDatabase()` or `openDatabase` temp dirs. Route tests register every route over the same mock stores via `openRoutesApp()`. Boot-wiring tests run the real `buildApp()` on a temp `DATA_DIR`. Tests that need a clock use `node:test` `mock.timers` (`Date`, and `setInterval` for the scheduler). Web projection tests build plain snapshot objects; alert and component tests install `localStorage` / `Audio` stand-ins.

## Fixtures

Inline constants and helper factories only — no fixture files.

## Conventions

- Layout: mirrored tree under `src/tests/` (not colocated with source), matching the area under test (`app/`, `routes/`, `services/`, `pause/`, `utils/`, `db/`, `components/`, `helpers/`); test files sit one folder below `src/tests/` because the script glob does not match files directly in it
- File naming: `<module>.test.ts` (e.g. `session.service.test.ts`, `sessionProjection.test.ts`)
- Blocks: `describe("ClassOrFn", () => { it("behavior…", …) })`
- Style: strict assert (`assert.equal`, `assert.ok`, `assert.throws`, `assert.deepEqual`)
- Server phase checks often narrow with `if (snap.status !== "active") throw …` after assert for TypeScript narrowing
- Packages do not import each other's application source for tests

---

## Manual smoke

### M2.5 short-rest ack + live stats

Operator checklist (not automated):

1. Soft pause default → short rest ends → ack window (countdown, hint) → acknowledge → running work; timeout path → `short_rest_ack_expired` sound → paused work → Resume
2. Hard pause enabled → ack timeout → frozen clock → Resume shifts deadline
3. Long rest completion → no ack prompt
4. HUD Worked / Deliberation / Rest / Paused counters increment during session; reset on next start
5. Hide Continue working (Browser preferences) → decision shows only Acknowledge rest; uncheck → Continue reappears

### M3 Compose recreate

Throwaway compose project with a named `/data` volume (no committed harness): start a session → `docker compose … up -d --force-recreate` → same session id resumes in `planned_work`. Fresh volume should be writable as `node` (UID 1000).
