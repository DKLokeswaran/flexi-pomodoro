# Error Handling & Validation

## Error types

### `SettingsError` (`apps/server/src/services/settings.service.ts`)

| Field | Type | Default |
|-------|------|---------|
| `message` | string | |
| `code` | string | `"INVALID_SETTINGS"` |
| `name` | `"SettingsError"` | |

`toSettingsError(error)`: passthrough `SettingsError`; maps `ZodError` issues to joined messages; rethrows unknowns.

### `SessionError` (`apps/server/src/services/session.service.ts`)

| Field | Type | Default |
|-------|------|---------|
| `message` | string | |
| `code` | string | `"SESSION_ERROR"` |
| `name` | `"SessionError"` | |

### Codes observed in committed code

| Code | Typical meaning |
|------|-----------------|
| `INVALID_SETTINGS` | Zod / bounds failure |
| `SESSION_ACTIVE` | Start while active |
| `NO_SESSION` | Action without session |
| `INVALID_PHASE` | Action not valid for current phase |
| `ALREADY_PAUSED` | Pause while already paused |
| `NOT_PAUSED` | Resume when not paused |
| `FORBIDDEN` / `PARAMS_LOCKED` | Mapped to HTTP 403 in routes (reserved) |

---

## Handling boundaries

### Server

- **No global Fastify `setErrorHandler`** in committed `app.ts`.
- Session and settings routes wrap handlers with shared `errorReply` (`apps/server/src/utils/errorReply.ts`), returning `{ error, code }` and status 400/403/409.
- Unmapped errors are **rethrown** → Fastify default 500 logging.
- Zod errors on session start/settings are normalized via `toSettingsError` / `ZodError` branch.

### Client

- `parseJson`: non-OK responses throw `Error` with server `error` field or `"Request failed (status)"`.
- `errorMessage(error, fallback)` (`apps/web/src/utils/errorMessage.ts`) prefers `Error.message` for toasts and settings-load failures.
- Mutations show toast via `ToastProvider`.
- SSE/poll errors are mostly swallowed (transient reconnect).
- `DebugFlagsProvider` / `AlertSeqStore`: localStorage failures caught; in-memory continues.
- React Error Boundaries: **not found** in committed history.

---

## Validation

**Library:** Zod `^4.4.3` (shared + server).

| Schema / parser | Where applied | Rules |
|-----------------|---------------|-------|
| `SessionParamsSchema` | Defaults / merge | Integer bounds from `SETTINGS_BOUNDS` |
| `SettingsSchema` / `SettingsPatchSchema` | PUT settings | Params + `alertsMuted` + `workPauseStrategy: "soft" \| "hard"` |
| `parseStartSessionBody` | POST start | Strict `debug`; overrides against debug-aware bounds |
| `DebugFlagsSchema` | start body + localStorage restore | Strict; unknown keys fail |
| `mergeSessionParams` | SettingsService | Parses merged settings+overrides |
| `AlertIdSchema` | shared enum | Alert ids |

### Bounds (production)

See `SETTINGS_BOUNDS` in [data-model.md](./data-model.md) / [api-reference.md](./api-reference.md).

### Debug overlay

`shortDurations` lowers mins for work/rest/decision to **1** second for **start overrides only**. Settings PUT still rejects sub-minute work (tested).

### Error message patterns

- Zod field messages like `` `${name} must be >= ${bounds.min}` `` via `boundedInt`.
- Session messages are human sentences, e.g. `"Pause is only available during planned work"`.
- Client toast uses `errorMessage(error, fallback)` (`Error.message` when present).

---

## Error message catalog (server-thrown strings)

| Message | Code |
|---------|------|
| A session is already active | `SESSION_ACTIVE` |
| No active session | `NO_SESSION` |
| Pause is only available during planned work | `INVALID_PHASE` |
| Already paused | `ALREADY_PAUSED` |
| Planned work already ended | `INVALID_PHASE` |
| Resume is only available during planned work | `INVALID_PHASE` |
| Not paused | `NOT_PAUSED` |
| Acknowledge rest is only valid in decision | `INVALID_PHASE` |
| Continue is only valid in decision | `INVALID_PHASE` |
| Start rest is only valid during extended work | `INVALID_PHASE` |
| Early end is only valid during long rest | `INVALID_PHASE` |
| Unknown debug feature: … | thrown from `getDebugFeature` (catalog helper) |
