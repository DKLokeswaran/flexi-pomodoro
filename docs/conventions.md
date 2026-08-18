# Coding Conventions

Derived from committed patterns (not aspirational rules).

## Naming

| Kind | Convention | Examples |
|------|------------|----------|
| Packages | `@flexi-pomodoro/<name>` | `shared`, `server`, `web` |
| Server route files | `<domain>.routes.ts` | `session.routes.ts` |
| Services | `<domain>.service.ts` | `session.service.ts` |
| Tests | `<domain>.service.test.ts` under `tests/services/`; pause plugins under `tests/pause/*.test.ts` | |
| Pause plugins | `pause/<id>Pause.ts` plus `types.ts` / `registry.ts` | `softPause.ts`, `hardPause.ts` |
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

- Server: `routes/` + `services/` + `pause/` + `utils/` + `tests/services/` (layer-based after 6df9a85).
- Web: `components/` (tabs + `timer/` + `about/`), `providers/`, `queries/`, `hooks/`, `utils/`, `constants/`.
- Styles: CSS modules co-located; global tokens/utilities in `styles.css`.
- Barrel files: route registration via `routes/index.ts`; pause plugins via `pause/index.ts`; shared via `packages/shared/src/index.ts`. Web API monolith barrel was removed (split into queries).

## Code structure within files

- **Imports:** external packages first, then `@flexi-pomodoro/shared`, then relative locals; type-only imports use `import type`.
- **Exports:** named exports preferred for components/hooks (`export function App`); default exports uncommon.
- **Functions:** mix of `function` declarations and arrow functions for small callbacks; classes for `SessionService`, `SettingsService`, `IntervalScheduler`, `AlertSeqStore`, `PauseStrategyRegistry`.
- **Async:** `async/await` for fetch and `buildApp`; fire-and-forget `void audio.play().catch`; SSE setup uses async `openSse`.
- Observed large files: `session.service.ts` (~470 lines), About tab (~237), shared `index.ts` (~242).

## Async & cancellation

- `EventSource` closed on cleanup; `closed` flag guards reopen.
- Intervals cleared on unmount (`useNow`, toast, SSE poll, scheduler `stop` on Fastify `onClose`).
- No `AbortController` usage found on fetch calls.

## Comments & docs

- Prefer short JSDoc (one or two lines) on functions and notable blocks: purpose at a high level.
- Inline comments for protocol quirks (SSE CONNECTING vs CLOSED; decision attribution).
- **TODO/FIXME:** none in committed `*.ts` / `*.tsx` / `*.md` sources searched.

## Formatting

Root `.prettierrc`: 2-space indent, double quotes, semicolons, trailing commas (`all`), print width 80. `.prettierignore` excludes `node_modules`, `dist`, `build`, `coverage`, `data`, `package-lock.json`, `.pi`, and `*.md`. Scripts: `npm run format` (`prettier --write .`), `npm run format:check`. `.git-blame-ignore-revs` skips the wholesale format commit so blame keeps original authors.

| Rule | Value |
|------|-------|
| Indent | 2 spaces |
| Quotes | Double quotes |
| Semicolons | Yes |
| Trailing commas | All |
| Print width | 80 |
| Modules | ESM (`"type": "module"`); server/shared use `.js` extensions in relative imports |
| Path aliases | Not configured; relative imports |

No ESLint config committed.

## UI / CSS conventions

- Design tokens on `:root` (`--bg0`, `--accent`, `--font-display`, phase colors `--rest`, `--decision`, `--extended`).
- Shared utility classes: `.panel`, `.btn`, `.btn-primary`, `.form-grid`, `.actions`, `.stub`, `.lead`.
- Phase label uses `data-phase={phase.kind}` for styling hooks.
- Fonts: Fraunces + Source Sans 3 (Google Fonts in `index.html`).

## TypeScript

- `strict: true` across packages.
- Web: `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`, bundler resolution.
- Server/shared: `NodeNext` module resolution; server build excludes tests.
