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
| Happy path N=2 | work → decision → ack short rest → work → long rest → idle; alerts; alertSeq reset |
| Alert seq reset | New session alerts restart at seq 1 |
| Decision timeout | → extended with backdated `startedAt`; startRest without replaying auto-start in pending |
| Continue | Extended `startedAt` = click time |
| Soft pause mid-work | `plannedEndAt` unchanged; `pausedSec` accumulates; `timerFrozenAt` stays null |
| Soft-paused through end | Auto rest; skip decision |
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

---

## Mocking patterns

Not found. Tests use real `SettingsService` + `SessionService` and inject deterministic `nowMs` into service methods (`start`, `pause`, `resume`, `getSnapshot`, `ackRest`, etc.). Scheduler is not exercised in these unit tests.

## Fixtures

Inline constants and helper factories only — no fixture files.

## Conventions

- File naming: `*.service.test.ts` under `src/tests/services/`
- Blocks: `describe("ClassOrFn", () => { it("behavior…", …) })`
- Style: strict assert (`assert.equal`, `assert.ok`, `assert.throws`, `assert.deepEqual`)
- Phase checks often narrow with `if (snap.status !== "active") throw …` after assert for TypeScript narrowing
