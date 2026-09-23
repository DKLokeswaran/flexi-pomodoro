# Flexi Pomodoro — Technical Documentation

Self-hosted, flow-aware Pomodoro timer. This documentation set describes the current source tree on branch `master` (version `0.0.2-alpha.3`). Product requirements and roadmap live separately under [`product/`](./product/).

## Quick start

```bash
# Node >= 20
npm install
npm run build -w @flexi-pomodoro/shared
npm run dev          # API :3847 + Vite :5173 (proxies /api)
npm test             # server then web unit tests
npm run typecheck
```

Production-style single process (after `npm run build`):

```bash
npm start            # serves API + apps/web/dist on PORT (default 3847)
```

Docker:

```bash
docker compose up --build
# http://localhost:4000 (maps host 4000 → container 3847)
# optional: FPMD_DATA_DIR=/path/on/host docker compose up --build
```

## Tech stack

| Layer | Stack |
|-------|--------|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Shared types/validation | TypeScript, Zod (`@flexi-pomodoro/shared`) |
| Server | Fastify 5, `@fastify/static`, Knex + better-sqlite3, Node 20+/22 |
| Web | React 19, Vite 6, TanStack Query 5, CSS modules |
| Tests | Node.js built-in test runner (`node:test`) |
| Deploy | Multi-stage Dockerfile, docker-compose |

## Architecture (overview)

```mermaid
flowchart LR
  Browser["Web (React/Vite)"]
  API["Server (Fastify)"]
  Shared["@flexi-pomodoro/shared"]
  Sched["IntervalScheduler 250ms"]
  Sess["SessionService"]
  Sett["SettingsService"]
  Store["SettingsStore / SQLite"]
  Pause["PauseStrategyRegistry"]

  Browser -->|"REST + SSE /api/*"| API
  Browser -.-> Shared
  API -.-> Shared
  API --> Sett
  API --> Sess
  Sett --> Store
  Sess --> Pause
  Sched -->|"tickIfIdle(nowMs)"| Sess
```

Request flow (session action): route → server Zod parsers (`settingsValidation`) → `await` `SettingsService` / `SessionService` (session mutations are async and mutex-serialized) → `SessionSnapshot` JSON (and SSE fan-out). Wall-clock catch-up is owned by the 250ms scheduler (`tickIfIdle`) and by commands that tick under the mutex before mutating; GET snapshot / SSE do not tick. Settings hydrate from SQLite at boot and persist on PUT.

## Documentation index

| Document | Contents |
|----------|----------|
| [architecture.md](./architecture.md) | Style, layers, patterns, DI, frontend/backend deep-dive |
| [structure.md](./structure.md) | Annotated tree, folder roles, where to add code |
| [modules.md](./modules.md) | Exported symbols, props, methods, imports |
| [api-reference.md](./api-reference.md) | REST + SSE endpoints, schemas, status codes |
| [data-model.md](./data-model.md) | SQLite schema, in-memory session models, phase types, DTOs |
| [state-management.md](./state-management.md) | React Query, contexts, localStorage, session stream |
| [error-handling.md](./error-handling.md) | Error classes, validation, client toasts |
| [security.md](./security.md) | Auth (none), CORS, secrets/env, browser storage |
| [testing.md](./testing.md) | Test stack, inventory, conventions |
| [build-and-deploy.md](./build-and-deploy.md) | Scripts, Docker, env catalog |
| [conventions.md](./conventions.md) | Naming, file layout, async, formatting |
| [dependencies.md](./dependencies.md) | Dependency inventory by category |
| [commit-history.md](./commit-history.md) | Stats, velocity, hotspots, full log |
| [glossary.md](./glossary.md) | Domain terms, phases, alerts, status values |
| [product/PRD.md](./product/PRD.md) | Product requirements (authoritative product spec) |
| [product/roadmap.md](./product/roadmap.md) | Milestone roadmap |

## Scope note

This technical documentation matches the current source tree.
