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
| Unit (web projection / liveStats helpers) | Yes |
| Integration (HTTP Fastify inject) | Not found |
| E2E / browser | Not found |
| Snapshot tests | Not found |
| Contract tests | Not found |

---

## Inventory

### `apps/server/src/tests/services/session.service.test.ts`

Helpers: `servicesWithShortTimers`, `startSession`, `activePhase`, `alertsSince`, `reachShortRestAck`, `liveStatsAt`; fixed clock `T0 = 2026-07-12T10:00:00.000Z`.

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
| Tick catch-up | Past work+decision → extended in one snapshot |
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

### `apps/server/src/tests/services/settings.service.test.ts`

Imports parsers from `utils/settingsValidation.ts`.

| Suite | Cases |
|-------|-------|
| `parseStartSessionBody` | Accepts 1s with flag; rejects 1s without; rejects unknown debug keys (`ZodError`) |
| `parseSettingsPatch` | Rejects sub-minute work |
| `SettingsService` | Accepts `workPauseStrategy: "hard"`; rejects non-int cycles; rejects 1s work in settings |

### `apps/server/src/tests/pause/softPause.test.ts`

Isolated `softPauseStrategy` unit tests (no `SessionService`):

| Case | Asserts |
|------|---------|
| `onPause` | Sets flags; `timerFrozenAt` null; `plannedEndAt` unchanged |
| `onResume` | Accumulates `pausedSec`; `plannedEndAt` unchanged |
| `onPlannedEnd` while paused | → `"rest"`; closes slice through planned end |
| `onPlannedEnd` while running | → `"decision"` |

### `apps/server/src/tests/pause/hardPause.test.ts`

Isolated `hardPauseStrategy` unit tests:

| Case | Asserts |
|------|---------|
| `onPause` | Sets `timerFrozenAt`; `isCountdownFrozen` true |
| `onResume` | Remaining time unchanged; `plannedEndAt` shifted by paused duration |
| `onPlannedEnd` | → `"decision"` when unfrozen |

### `apps/web/src/tests/utils/liveStats.test.ts`

| Case | Asserts |
|------|---------|
| Soft pause | `pausedSec` grows with wall clock; `workedSec` holds at pause start |
| Hard pause | Same paused growth; worked holds while `timerFrozenAt` set |

### `apps/web/src/tests/utils/sessionProjection.test.ts`

| Case | Asserts |
|------|---------|
| Nominal duration N=2 / N=1 | Work + short rests + long rest arithmetic |
| `estimatedSessionEndMs` | Equals start + nominal duration |
| DEFAULT_SETTINGS | Matches formula for default cycle count |

### `apps/web/src/tests/utils/activeSessionProjection.test.ts`

Fabricated `ActiveSnapshot` fixtures only (no server imports).

| Case | Asserts |
|------|---------|
| Planned work happy path | Matches idle nominal end |
| Decision / extended | End advances with wall clock |
| Extended → rest | Slip persists via rest anchors |
| Hard pause open / resume | Open pause adds time; shifted `plannedEndAt` keeps it after resume |
| Short rest after deliberation | Anchor slip reflected |
| Extended → rest ETA stability | Projection unchanged across the transition at the same slip |

---

## Mocking patterns

Not found. Server tests use real `SettingsService` + `SessionService` and inject deterministic `nowMs`. Web projection tests build plain snapshot objects. Scheduler is not exercised in these unit tests.

## Fixtures

Inline constants and helper factories only — no fixture files.

## Conventions

- Layout: mirrored tree under `src/tests/` (not colocated with source), matching the area under test (`services/`, `pause/`, `utils/`)
- File naming: `<module>.test.ts` (e.g. `session.service.test.ts`, `sessionProjection.test.ts`)
- Blocks: `describe("ClassOrFn", () => { it("behavior…", …) })`
- Style: strict assert (`assert.equal`, `assert.ok`, `assert.throws`, `assert.deepEqual`)
- Server phase checks often narrow with `if (snap.status !== "active") throw …` after assert for TypeScript narrowing
- Packages do not import each other's application source for tests

---

## Manual smoke (M2.5 short-rest ack + live stats)

Operator checklist (not automated):

1. Soft pause default → short rest ends → ack window (countdown, hint) → acknowledge → running work; timeout path → `short_rest_ack_expired` sound → paused work → Resume
2. Hard pause enabled → ack timeout → frozen clock → Resume shifts deadline
3. Long rest completion → no ack prompt
4. HUD Worked / Deliberation / Rest / Paused counters increment during session; reset on next start
5. Hide Continue working (Browser preferences) → decision shows only Acknowledge rest; uncheck → Continue reappears
