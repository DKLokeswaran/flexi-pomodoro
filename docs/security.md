# Security

## Authentication

**Not found in committed history.** No JWT, session cookies, OAuth, API keys, or login flows. The app is designed as a **self-hosted single-user** instance (see About / PRD notes).

## Authorization

**Not found in committed history.** No RBAC/ABAC, roles, or permission middleware. HTTP 403 mapping exists for codes `FORBIDDEN` and `PARAMS_LOCKED` but those codes are not emitted by the M1 session paths documented in services.

## CORS

**Not found as explicit `@fastify/cors` config.** Dev relies on Vite proxy (`/api` → `127.0.0.1:3847`) so the browser stays same-origin. Production serves SPA and API from one Fastify process.

## Security headers

**Not found** (no helmet or custom CSP headers in committed server code).

## Input validation & injection

- All mutable API bodies go through **Zod** schemas (server `SettingsPatchSchema` / `parseStartSessionBody`, shared `parseDebugFlags`, etc.).
- No SQL layer → no SQL injection surface in M1.
- SSE payloads are server-serialized `JSON.stringify` of internal snapshots.
- Client `JSON.parse` of EventSource data is try/catch guarded.

## Secrets & environment

| Key | Required? | Default | Usage |
|-----|-----------|---------|-------|
| `PORT` | optional | `3847` | Listen port (`index.ts`, Docker, compose, root scripts) |
| `HOST` | optional | `0.0.0.0` | Listen host |
| `WEB_DIST` | optional | discovery candidates | Static file root |
| `NODE_ENV` | set in Docker runtime | `production` | Runtime image |
| `TZ` | compose | `Asia/Kolkata` | Container timezone |

No password hashing, crypto secrets, or `.env` samples committed. `.gitignore` excludes `.env` / `.env.local`.

## Browser storage

| Key | Sensitivity |
|-----|-------------|
| `flexi-pomodoro:debugFlags` | UX preference only |
| `flexi-pomodoro:uiFlags` | UX preference only |
| `flexi-pomodoro:lastPlayedAlertSeq` | Client watermark; not a secret |

## CSRF / rate limiting / XSS

| Control | Status |
|---------|--------|
| CSRF tokens | Not found (cookie auth absent; same-origin fetch) |
| Rate limiting | Not found |
| XSS | React text escaping by default; About uses controlled constants; diagnostics use `navigator` strings |

## External links

About live links open GitHub with `rel="noopener noreferrer"` when `external` is set (`LinkCard`).

## Known product stance

About/legal copy states session data stays on the instance; persistence across restarts is future work. Treat the open HTTP API as **trusted LAN / single-user** until auth is added.
