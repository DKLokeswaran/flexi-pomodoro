# Dependencies

Inventory from committed `package.json` files and lockfile versions for direct packages (`package-lock.json` at `HEAD`).

## Workspace packages

| Package | Version field | Role |
|---------|---------------|------|
| `flexi-pomodoro` (root) | `0.0.1-alpha.4` | Workspaces orchestrator |
| `@flexi-pomodoro/shared` | `0.0.0` private | Domain contract |
| `@flexi-pomodoro/server` | `0.0.0` private | API |
| `@flexi-pomodoro/web` | `0.0.0` private | SPA |

Internal deps use `"@flexi-pomodoro/shared": "*"`.

---

## By category

### UI framework

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `react` | ^19.1.0 | 19.2.7 | web prod |
| `react-dom` | ^19.1.0 | 19.2.7 | web prod |
| `@types/react` | ^19.1.6 | 19.2.17 | web dev |
| `@types/react-dom` | ^19.1.5 | 19.2.3 | web dev |

### Icons / brand assets

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `lucide-react` | ^1.25.0 | 1.25.0 | web prod |
| `simple-icons` | ^16.27.0 | 16.27.0 | web prod (GitHub glyph) |

### State / data fetching

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `@tanstack/react-query` | ^5.101.2 | 5.101.2 | web prod |

### HTTP / server

| Package | Declared | Locked | Scope | Notes |
|---------|----------|--------|-------|-------|
| `fastify` | ^5.4.0 | 5.10.0 | server prod | Security-sensitive: HTTP stack |
| `@fastify/static` | ^8.2.0 | 8.3.0 | server prod | Static file serving |

### Validation

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `zod` | ^4.4.3 | 4.4.3 | shared + server prod |

### Build tooling

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `vite` | ^6.3.5 | 6.4.3 | web dev |
| `@vitejs/plugin-react` | ^4.5.2 | 4.7.0 | web dev |
| `tsx` | ^4.19.4 | 4.23.0 | server dev (watch + tests) |
| `typescript` | ^5.8.3 | 5.9.3 | shared/server/web dev |

### Types

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `@types/node` | ^22.15.30 | 22.20.1 | server dev |

### Database / ORM / auth / testing libs

**Not found** as direct dependencies (no Prisma, better-sqlite3, passport, vitest, jest, playwright, etc.).

---

## Security-sensitive packages

| Package | Why |
|---------|-----|
| `fastify` / `@fastify/static` | Network attack surface, path serving |
| `zod` | Input boundary hardening (positive control) |

No dedicated crypto/auth client libraries committed.

## Linting / formatting packages

| Package | Declared | Locked | Scope |
|---------|----------|--------|-------|
| `prettier` | ^3.9.6 | 3.9.6 | root dev |

No ESLint package or config committed.

## Transitive dependencies

Hundreds via `package-lock.json` (3562 lines). Prefer lockfile for exact transitive versions; only direct packages are tabulated above.
