# Testing Strategy

## Framework stack

| Piece | Choice |
|-------|--------|
| Runner | Node.js built-in `node:test` via `tsx --test` |
| Assertions | `node:assert/strict` |
| Mocking library | Not found (tests construct real services / fabricated snapshots) |
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
| Unit (web projection / liveStats / dialProgress helpers) | Yes |
| Integration (HTTP Fastify inject) | Not found |
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
| migration defaults timezone | Seeded `timezone` is `UTC`; column present after migrations |
| initial migration | Expected tables present (`settings`, `sessions`, `phases`, detail tables, `pause_slices`, `daily_stats`, …); `stores.analytics` present |

### `apps/server/src/tests/db/analyticsStore.test.ts`

Uses temp migrated SQLite.

| Case | Asserts |
|------|---------|
| migration | `daily_stats` table + expected columns |
| overlapping lists | Closed planned-work (and related) rows filtered by day window |
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
| alertSeq restore | Runtime `alertSeq` rebuilt |
| Recovery past planned end | Work closed with `endedReason: "recovery"` |
| recoveryTick flag reset | Later closes use live endedReason |
| Session complete | Clears `session_runtime` |
| Soft-paused hydrate | Open pause slice restored |
| Hard-paused recovery | Does not advance past original planned end while frozen |
| Hard ack timeout + long downtime | Stays frozen planned_work past next planned end |
| CORRUPT_RUNTIME abandon | Clears runtime; idle `recoveryAbandonedMessage` |

### `apps/server/src/tests/services/session.recovery.matrix.test.ts`

Q9 Option A recovery scenarios via hydrate + `runRecoveryTick` on temp SQLite.

| Case | Asserts |
|------|---------|
| S3 | Through short rest → short_rest_ack (still in window) |
| S5 | Through long rest end → idle session complete |
| S6 | During extended → still extended; overtime includes downtime |
| S8a | SHORT_REST_ACK inside window → restore ack |

### `apps/server/src/tests/services/settings.service.persist.test.ts`

| Case | Asserts |
|------|---------|
| Restart round-trip | New `SettingsService` + same DB loads saved settings via `hydrate` |

### `apps/server/src/tests/helpers/mockSettingsStore.ts`

In-memory `SettingsStore` double for service unit tests (`load` / `save` / `ensureSeeded` + optional `saves` spy).

### `apps/server/src/tests/helpers/mockSessionStores.ts`

`createMockSessionStores()` — in-memory `SessionStore` + `PhasesStore` for `SessionService` unit tests (no SQLite).

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

### `apps/server/src/tests/services/analytics.service.test.ts`

| Case | Asserts |
|------|---------|
| empty day | Zero totals for a day with no closed phases |
| `dayStats` | Returns `clientDate` bounds + closed-phase aggregates (incl. pause subtraction from worked) |
| full in-day phase | Attributes full worked / deliberation / rest for phases entirely inside the day |
| midnight-spanning | Splits / clips phases across adjacent client days |
| `todayStats` | Matches `dayStats` for the current client date |
| `finalizeDueDays` | Backfills missing `daily_stats` through yesterday; leaves today open |

### `apps/server/src/tests/routes/analytics.routes.test.ts`

| Case | Asserts |
|------|---------|
| GET today | Returns `todayStats()` body; day query params ignored |

### `apps/web/src/tests/utils/liveStats.test.ts`

| Case | Asserts |
|------|---------|
| Soft pause | `pausedSec` grows with wall clock; `workedSec` holds at pause start |
| Hard pause | Same paused growth; worked holds while `timerFrozenAt` set |

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

---

## Mocking patterns

Settings unit tests inject `createMockSettingsStore()`. `SessionService` tests inject `createMockSessionStores()` (no SQLite) with deterministic `nowMs`. Store tests use `openTempDatabase()` or `openDatabase` temp dirs. Web projection tests build plain snapshot objects. Scheduler is not exercised in these unit tests.

## Fixtures

Inline constants and helper factories only — no fixture files.

## Conventions

- Layout: mirrored tree under `src/tests/` (not colocated with source), matching the area under test (`services/`, `pause/`, `utils/`, `db/`, `helpers/`)
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
