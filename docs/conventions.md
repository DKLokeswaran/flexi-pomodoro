# Coding Conventions

Derived from committed patterns (not aspirational rules).

## Naming

| Kind | Convention | Examples |
|------|------------|----------|
| Packages | `@flexi-pomodoro/<name>` | `shared`, `server`, `web` |
| Server route files | `<domain>.routes.ts` | `session.routes.ts` |
| Services | `<domain>.service.ts` | `session.service.ts` |
| Tests | `<domain>.service.test.ts` under `tests/services/` | |
| React components | PascalCase file matching export | `ActiveTimer.tsx` |
| CSS modules | `<Component>.module.css` | `AboutTab.module.css` |
| Shared timer display CSS | `timerDisplay.module.css` | used by Idle + Active |
| Hooks | `use*` | `useSessionStream`, `useNow` |
| API modules | `<domain>.api.ts` | `session.api.ts` |
| Constants / labels | camelCase exports | `DECISION_WINDOW_LABEL` |
| localStorage keys | `flexi-pomodoro:<name>` | `debugFlags`, `lastPlayedAlertSeq` |
| Alert assets | `placeholder-<alertId>.wav` | |
| Types | PascalCase | `SessionSnapshot`, `Phase` |
| Zod schemas | `*Schema` | `SettingsPatchSchema` |
| Error classes | `*Error` with `code` string | `SessionError` |

## File organization

- Server: `routes/` + `services/` + `tests/services/` (layer-based after 6df9a85).
- Web: `components/` (tabs + `timer/` + `about/`), `providers/`, `queries/`, `hooks/`, `utils/`, `constants/`.
- Styles: CSS modules co-located; global tokens/utilities in `styles.css`.
- Barrel files: route registration via `routes/index.ts`; shared via `packages/shared/src/index.ts`. Web API monolith barrel was removed (split into queries).

## Code structure within files

- **Imports:** external packages first, then `@flexi-pomodoro/shared`, then relative locals; type-only imports use `import type`.
- **Exports:** named exports preferred for components/hooks (`export function App`); default exports uncommon.
- **Functions:** mix of `function` declarations and arrow functions for small callbacks; classes for `SessionService`, `SettingsService`, `IntervalScheduler`, `AlertSeqStore`.
- **Async:** `async/await` for fetch and `buildApp`; fire-and-forget `void audio.play().catch`; SSE setup uses async `openSse`.
- Observed large files: `session.service.ts` (~417 lines), About tab (~231), shared `index.ts` (~240).

## Async & cancellation

- `EventSource` closed on cleanup; `closed` flag guards reopen.
- Intervals cleared on unmount (`useNow`, toast, SSE poll, scheduler `stop` on Fastify `onClose`).
- No `AbortController` usage found on fetch calls.

## Comments & docs

- Prefer short JSDoc on non-obvious public helpers (`parseStartSessionBody`, `tick`, soft-pause analytics notes).
- Inline comments for protocol quirks (SSE CONNECTING vs CLOSED; decision attribution).
- **TODO/FIXME:** none in committed `*.ts` / `*.tsx` / `*.md` sources searched.

## Formatting (observed)

| Rule | Observation |
|------|-------------|
| Indent | 2 spaces |
| Quotes | Double quotes |
| Semicolons | Yes |
| Trailing commas | Yes in multi-line literals |
| Modules | ESM (`"type": "module"`); server/shared use `.js` extensions in relative imports |
| Path aliases | Not configured; relative imports |

No Prettier/ESLint config committed — formatting is by hand/editor habit.

## UI / CSS conventions

- Design tokens on `:root` (`--bg0`, `--accent`, `--font-display`, phase colors `--rest`, `--decision`, `--extended`).
- Shared utility classes: `.panel`, `.btn`, `.btn-primary`, `.form-grid`, `.actions`, `.stub`, `.lead`.
- Phase label uses `data-phase={phase.kind}` for styling hooks.
- Fonts: Fraunces + Source Sans 3 (Google Fonts in `index.html`).

## TypeScript

- `strict: true` across packages.
- Web: `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`, bundler resolution.
- Server/shared: `NodeNext` module resolution; server build excludes tests.
