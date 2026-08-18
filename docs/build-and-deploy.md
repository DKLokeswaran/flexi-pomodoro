# Build, Scripts & Deployment

## Available commands

### Root (`flexi-pomodoro`)

| Script | Behavior |
|--------|----------|
| `dev` | Build shared, then `dev:server` & `dev:web` in parallel (`wait`) |
| `dev:server` | `PORT=3847 npm run dev -w @flexi-pomodoro/server` |
| `dev:web` | Vite for web workspace |
| `build` | shared → web → server |
| `start` | `PORT=3847 WEB_DIST=$PWD/apps/web/dist` server start |
| `test` | Server tests |
| `typecheck` | shared + server + web |
| `format` | `prettier --write .` |
| `format:check` | `prettier --check .` |

### `@flexi-pomodoro/server`

| Script | Behavior |
|--------|----------|
| `dev` | `tsx watch src/index.ts` |
| `build` | `tsc -p tsconfig.json` |
| `start` | `node dist/index.js` |
| `test` | `tsx --test src/tests/**/*.test.ts` |
| `typecheck` | `tsc --noEmit` |

### `@flexi-pomodoro/web`

| Script | Behavior |
|--------|----------|
| `dev` | `vite` (port 5173, `/api` proxy) |
| `build` | `tsc --noEmit && vite build` → `dist/` |
| `preview` | `vite preview` |
| `typecheck` | `tsc --noEmit` |

### `@flexi-pomodoro/shared`

| Script | Behavior |
|--------|----------|
| `build` | `tsc` → `dist/` + declarations |
| `dev` | `tsc --watch` |
| `typecheck` | `tsc --noEmit` |

---

## Build pipeline

1. Compile shared package (types + JS consumed by server/web).
2. Web: typecheck then Vite bundle; injects `__APP_VERSION__` from root `package.json` version.
3. Server: `tsc` to `apps/server/dist` (tests excluded).

**Environment modes:** Vite `define` for version; Docker sets `NODE_ENV=production`. No separate staging config files committed.

---

## Containerization

### Dockerfile (multi-stage)

| Stage | Base | Actions |
|-------|------|---------|
| `deps` | `node:22-bookworm-slim` | Copy package manifests; `npm ci` |
| `build` | from deps | Copy sources; build shared, web, server |
| `runtime` | `node:22-bookworm-slim` | Prod `npm ci --omit=dev` for server+shared; copy dists; `EXPOSE 3847`; `VOLUME ["/data"]`; `CMD node dist/index.js` from `apps/server` |

### docker-compose.yml

| Service | Ports | Env | Volumes |
|---------|-------|-----|---------|
| `flexi-pomodoro` | `3847:3847` | `TZ=Asia/Kolkata`, `PORT=3847` | `flexi-pomodoro-data:/data` (stub) |

`restart: unless-stopped`.

---

## CI/CD

**Not found in committed history** (no `.github/workflows`, etc.).

## Tags / releases (git)

| Tag | Creator date (ref) |
|-----|--------------------|
| `v0.0.1-alpha.4` | 2026-07-22 |
| `v0.0.1-alpha.3` | 2026-07-21 |
| `v0.0.1-alpha.2` | 2026-07-16 |
| `v0.0.1-alpha.1` | 2026-07-14 |

Root package version string: `0.0.1-alpha.4`.

---

## Environment variable catalog

| Variable | Where referenced | Default / notes |
|----------|------------------|-----------------|
| `PORT` | `apps/server/src/index.ts`, Dockerfile, compose, root scripts | `3847` |
| `HOST` | `apps/server/src/index.ts` | `0.0.0.0` |
| `WEB_DIST` | `apps/server/src/app.ts`, Dockerfile, root `start` | Optional; else path candidates relative to dist/cwd |
| `NODE_ENV` | Dockerfile runtime | `production` |
| `TZ` | docker-compose | `Asia/Kolkata` |

Build-time define (not env): `__APP_VERSION__` from root package version via Vite.

---

## Engines

Root `package.json`: `"node": ">=20"`. Docker runtime uses Node 22.
