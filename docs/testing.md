# Testing Strategy

## Framework stack

| Piece | Choice |
|-------|--------|
| Runner | Node.js built-in `node:test` via `tsx --test` |
| Assertions | `node:assert/strict` |
| Mocking library | Not found (tests construct real services) |
| Coverage tooling | Not found in committed scripts |
| Web / e2e tests | Not found in committed history |

**Script:** `apps/server` → `"test": "tsx --test src/tests/**/*.test.ts"`; root `"test": "npm run test -w @flexi-pomodoro/server"`.

Server `tsconfig.json` **excludes** `src/tests/**` from the production `tsc` build (tests run via tsx only).

---

## Test types present

| Type | Present? |
|------|----------|
| Unit (services + shared parsers) | Yes |
| Integration (HTTP Fastify inject) | Not found |
| E2E / browser | Not found |
| Snapshot tests | Not found |
| Contract tests | Not found |

---

## Inventory

### `apps/server/src/tests/services/session.service.test.ts`

Helpers: `servicesWithShortTimers`, `startSession`, `activePhase`, `alertsSince`; fixed clock `T0 = 2026-07-12T10:00:00.000Z`.

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

### `apps/server/src/tests/services/settings.service.test.ts`

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

### `apps/server/src/tests/shared/liveStats.test.ts`

Imports web `liveStatsAt`.

| Case | Asserts |
|------|---------|
| Soft pause | `pausedSec` grows with wall clock; `workedSec` holds at pause start |
| Hard pause | Same paused growth; worked holds while `timerFrozenAt` set |

### `apps/server/src/tests/shared/sessionProjection.test.ts`

Imports web `sessionProjection` helpers (tsx path into `apps/web`).

| Case | Asserts |
|------|---------|
| Nominal duration N=2 / N=1 | Work + short rests + long rest arithmetic |
| `estimatedSessionEndMs` | Equals start + nominal duration |
| DEFAULT_SETTINGS | Matches formula for default cycle count |
| Instant-ack happy path | `SessionService` goes idle at projected end |

### `apps/server/src/tests/shared/activeSessionProjection.test.ts`

Imports web `activeSessionProjection` helpers.

| Case | Asserts |
|------|---------|
| Planned work happy path | Matches idle nominal end |
| Decision / extended | End advances with wall clock |
| Extended → rest | Slip persists via rest anchors |
| Hard pause open / resume | Open pause adds time; shifted `plannedEndAt` keeps it after resume |
| Short rest after deliberation | Anchor slip reflected |
| SessionService extended → rest | Projection stable across transition |

---

## Mocking patterns

Not found. Tests use real `SettingsService` + `SessionService` and inject deterministic `nowMs` into service methods (`start`, `pause`, `resume`, `getSnapshot`, `ackRest`, `ackWork`, etc.). Scheduler is not exercised in these unit tests.

## Fixtures

Inline constants and helper factories only — no fixture files.

## Conventions

- File naming: `*.service.test.ts` under `src/tests/services/`; pause plugins under `src/tests/pause/*.test.ts`; web projection helpers under `src/tests/shared/*.test.ts`
- Blocks: `describe("ClassOrFn", () => { it("behavior…", …) })`
- Style: strict assert (`assert.equal`, `assert.ok`, `assert.throws`, `assert.deepEqual`)
- Phase checks often narrow with `if (snap.status !== "active") throw …` after assert for TypeScript narrowing
