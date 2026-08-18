# Commit History & Change Log

Source: `git log HEAD` on branch `master` (working-tree changes excluded).

## Statistics

| Metric | Value |
|--------|-------|
| Total commits | 31 |
| First commit date | 2026-07-12 |
| Latest commit date | 2026-08-18 |
| Active contributors | 1 |
| Most active contributor | Lokeswaran DK (31) |
| Conventional-commit prefix count (`feat`/`fix`/…) | 4 (`chore` × 3, `style` × 1) |
| Tags | `v0.0.1-alpha.1` … `v0.0.1-alpha.4`, `v0.0.2-alpha.0` |

## Commit velocity

| Month | Commits |
|-------|--------:|
| 2026-07 | 23 |
| 2026-08 | 7 |

## Hotspot analysis (top changed paths across history)

Counts include historical paths that may have been renamed/moved.

| Changes | Path |
|--------:|------|
| 6 | `docs/PRD.md` (later moved to `docs/product/PRD.md`) |
| 6 | `apps/web/src/App.tsx` |
| 6 | `package-lock.json` |
| 5 | `apps/web/src/styles.css` |
| 5 | `apps/web/src/api.ts` (later split) |
| 5 | `packages/shared/src/index.ts` |
| 5 | `package.json` |
| 4 | `docs/roadmap.md` (later `docs/product/roadmap.md`) |
| 4 | `apps/web/src/main.tsx` |
| 4 | `apps/server/src/session/engine.ts` (later `services/session.service.ts`) |
| 4 | `apps/server/src/session/engine.test.ts` |
| 4 | `apps/server/src/routes/api.ts` (later `session.routes.ts`) |
| 3 | `.cursor/plans/m1_timer_core.plan.md` |
| 3 | `apps/web/src/hooks/useSessionStream.ts` |
| 3 | Timer UI / NumberField / Nav (various names) |

High churn on PRD, App shell, styles, and the session engine reflects alpha product definition + M1 timer core iteration.

## Feature timeline (narrative)

### 2026-07-12 — Product definition

- Initial PRD; refinements for session/pause/flow.
- Strict wall-clock catch-up recovery policy locked.
- Soft-pause-at-planned-end behavior defined.
- Roadmap (alpha → post-v1) and M1 plan + beta coverage notes.

### 2026-07-14 — M1 timer core checkpoint (`v0.0.1-alpha.1` era)

- Monorepo scaffold: shared, Fastify server, React/Vite web, Docker.
- In-memory session engine, REST + SSE, settings, placeholder alerts.
- Root scripts, lockfile, alpha Docker packaging.

### 2026-07-16 — Debug short durations (`v0.0.1-alpha.2`)

- Per-feature debug catalog; short duration bounds for QA.
- Settings UI debug gate; shared bounds helpers.

### 2026-07-21 — Alert sequence integrity (`v0.0.1-alpha.3`)

- Reset alert seq per session; client watermark sync with server.

### 2026-07-22 — Decision attribution, UX, About (`v0.0.1-alpha.4`)

- `SESSION_API` shared constants.
- Decision timeout counts as extended work; continue starts at click.
- Decision UI/toasts; SSE reconnect hardening.
- Regenerated placeholder WAVs; PRD/roadmap decision-window docs.
- Debug prefs in localStorage; production-style About tab.

### 2026-07-23 — Web folder & CSS module split

- Reorganize web into providers/queries/utils/feature folders.
- Co-locate CSS modules per component.

### 2026-07-24 — Client/server layering & docs layout

- Split web API client into domain modules + SSE transport module.
- Split server into services/routes with mirrored tests.
- Move PRD/roadmap under `docs/product/`.
- Add technical reference docs under `docs/` (architecture, API, modules, operations).
- Expand PRD and roadmap with SHORT_REST_ACK, live session stats, idle today stats, and M2.5/M3.5 alpha milestones.

### 2026-08-13 — Ignore local tooling

- Ignore the `.pi` directory.

### 2026-08-16 — Readability pass

- Clearer names, smaller functions, and shared helpers across server, web, and shared (including a shared HTTP `errorReply` mapper).

### 2026-08-17 — Prettier

- Add Prettier with project config (`format` / `format:check`).
- Reformat existing source; no behavior changes.
- Ignore the format commit in git blame.

### 2026-08-18 — M2 pause modules

- Extract soft pause into `WorkPauseStrategy` plugins; unify HTTP to `/pause` and `/resume`.
- Add hard pause plugin (frozen countdown, shifted `plannedEndAt` on resume).
- Settings experimental gate + hard pause toggle; session start locks strategy from settings.
- Timer UI: strategy-aware labels, `timerFrozenAt` clock freeze, About marks hard pause available.
- Isolated soft/hard pause plugin tests; hard-pause engine cases; FR-PAUSE-S6 phase rejection; tag `v0.0.2-alpha.0`.

## Breaking changes

No commit messages contain `BREAKING CHANGE`. Behavioral shifts of note (from messages/tests):

- Decision timeout attribution to extended work (affects analytics/persistence design).
- Alert sequence reset on session end (clients must sync watermark).
- Path/file renames (`engine` → `session.service`, `api.ts` split, docs move) — import path breaks for external consumers of old layout.
- Session pause endpoints renamed from `/api/session/soft-pause` and `/soft-resume` to `/pause` and `/resume`; planned-work phase fields renamed from `softPaused*` to strategy-neutral `paused*`.

## Full commit log

| Hash | Author | Date | Message |
|------|--------|------|---------|
| 700b290 | Lokeswaran DK | 2026-08-18 | Add pause strategy tests and tag v0.0.2-alpha.0. |
| b639f4f | Lokeswaran DK | 2026-08-18 | Add hard pause strategy with Settings toggle and session-start wiring. |
| c2863b4 | Lokeswaran DK | 2026-08-18 | Extract soft pause into a WorkPauseStrategy plugin with strategy-agnostic pause and resume APIs. |
| c5413fa | Lokeswaran DK | 2026-08-17 | chore: ignore the Prettier format commit in git blame |
| 473d4b5 | Lokeswaran DK | 2026-08-17 | style: apply Prettier formatting |
| c7a7d79 | Lokeswaran DK | 2026-08-17 | chore: add Prettier with project config |
| 8589993 | Lokeswaran DK | 2026-08-16 | Improve readability across server, web, and shared with clearer names, smaller functions, and shared helpers. |
| cd52edd | Lokeswaran DK | 2026-08-13 | chore: ignore .pi directory |
| 84bd35c | Lokeswaran DK | 2026-07-24 | Document short-rest acknowledgement and M2.5/M3.5 alpha milestones. |
| aa1123e | Lokeswaran DK | 2026-07-24 | Add technical reference docs generated from committed codebase history. |
| 735e7ab | Lokeswaran DK | 2026-07-24 | Move PRD and roadmap under docs/product for clearer doc organization. |
| 6df9a85 | Lokeswaran DK | 2026-07-24 | Split server into layer-based services, routes, and mirrored tests. |
| 1d73dd0 | Lokeswaran DK | 2026-07-24 | Split monolithic api client into domain modules and session SSE transport. |
| b04d11e | Lokeswaran DK | 2026-07-23 | Split web component styles into CSS modules alongside each component. |
| ca8e7c6 | Lokeswaran DK | 2026-07-23 | Reorganize web src into api, providers, queries, utils, and feature folders. |
| 48198eb | Lokeswaran DK | 2026-07-22 | Add production-style About tab with link cards, accordions, and diagnostics. |
| a44cc7b | Lokeswaran DK | 2026-07-22 | Persist debug feature preferences in localStorage. |
| 90999f3 | Lokeswaran DK | 2026-07-22 | Document decision-window attribution for M3 persistence and analytics. |
| 8805f40 | Lokeswaran DK | 2026-07-22 | Regenerate placeholder alert sounds with target durations. |
| f4d0dcb | Lokeswaran DK | 2026-07-22 | Improve decision UI and user feedback; fix SSE reconnect delay. |
| df1d508 | Lokeswaran DK | 2026-07-22 | Attribute decision timeout to extended work and tighten session API types. |
| 3603978 | Lokeswaran DK | 2026-07-22 | Add SESSION_API constants for shared client/server paths. |
| b86d8bc | Lokeswaran DK | 2026-07-21 | Reset alert sequence per session and sync client watermark with server. |
| 5660c71 | Lokeswaran DK | 2026-07-16 | Add per-feature debug flags with short durations for QA. |
| 89dd541 | Lokeswaran DK | 2026-07-14 | Checkpoint partial M1 timer core for alpha development. |
| 803c1e0 | Lokeswaran DK | 2026-07-12 | Add M1 implementation plan and beta test coverage to roadmap. |
| 45b6132 | Lokeswaran DK | 2026-07-12 | Add product roadmap covering alpha through post-v1 themes. |
| 8ad79c8 | Lokeswaran DK | 2026-07-12 | Define soft-pause behavior when planned work ends. |
| 5b956c9 | Lokeswaran DK | 2026-07-12 | Lock PRD recovery policy to strict wall-clock catch-up. |
| 6583d56 | Lokeswaran DK | 2026-07-12 | Refine PRD with session, pause, and flow clarifications. |
| 3b25f3e | Lokeswaran DK | 2026-07-12 | Add initial Flexi Pomodoro product requirements document. |

Last Synced Commit: 700b29022919ef642dc92f611472852903db19c2
