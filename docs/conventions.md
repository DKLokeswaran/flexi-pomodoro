# Coding Conventions

Derived from committed patterns (not aspirational rules).

## Naming

| Kind | Convention | Examples |
|------|------------|----------|
| Packages | `@flexi-pomodoro/<name>` | `shared`, `server`, `web` |
| Server route files | `<domain>.routes.ts` | `session.routes.ts` |
| Services | `<domain>.service.ts` | `session.service.ts` |
| Tests | `<module>.test.ts` under `src/tests/<area>/` (mirrors source; not colocated) | `tests/services/session.service.test.ts`, `tests/utils/liveStats.test.ts` |
| Pause plugins | `pause/<id>Pause.ts` plus `types.ts` / `registry.ts` | `softPause.ts`, `hardPause.ts` |
| React components | PascalCase file matching export | `ActiveTimer.tsx` |
| shadcn primitives | `components/ui/<name>.tsx` | `button.tsx`, `field.tsx` |
| Shared timer Tailwind maps | `timerDisplay.ts` object of class strings | used by Idle + Active |
| Hooks | `use*` | `useSessionStream`, `useNow` |
| API modules | `<domain>.api.ts` | `session.api.ts` |
| Constants / labels | camelCase exports | `DECISION_WINDOW_LABEL` |
| localStorage keys | `flexi-pomodoro:<name>` | `debugFlags`, `uiFlags`, `lastPlayedAlertSeq`, `tzSeeded` |
| Alert assets | `placeholder-<alertId>.wav` | |
| Types | PascalCase | `SessionSnapshot`, `Phase` |
| Zod schemas | `*Schema` | `SettingsPatchSchema` |
| Error classes | `*Error` with `code` string | `SessionError` |

## File organization

- Server: `routes/` + `services/` + `pause/` + `utils/` + `tests/services/` (layer-based after 6df9a85).
- Web: `components/` (tabs + `timer/` + `about/` + `ui/`), `providers/`, `queries/`, `hooks/`, `utils/`, `lib/`, `constants/`.
- Styles: Tailwind utility classes on components; Quiet Dark / shadcn tokens and type utilities in `styles.css`; design authority in `DESIGN.md`.
- Barrel files: route registration via `routes/index.ts`; pause plugins via `pause/index.ts`; shared via `packages/shared/src/index.ts`. Web API monolith barrel was removed (split into queries).

## Code structure within files

- **Imports:** external packages first, then `@flexi-pomodoro/shared`, then relative locals; type-only imports use `import type`.
- **Exports:** named exports preferred for components/hooks (`export function App`); default exports uncommon.
- **Functions:** mix of `function` declarations and arrow functions for small callbacks; classes for `SessionService`, `SettingsService`, `IntervalScheduler`, `AlertSeqStore`, `PauseStrategyRegistry`.
- **Async:** `async/await` for fetch and `buildApp`; fire-and-forget `void audio.play().catch`; SSE setup uses async `openSse`.
- Observed large files: `session.service.ts`, `AboutTab.tsx`, `ActiveTimer.tsx` / `TimerDial.tsx`, shared `index.ts`.

## Async & cancellation

- `EventSource` closed on cleanup; `closed` flag guards reopen.
- Intervals cleared on unmount (`useNow`, toast, SSE poll, scheduler `stop` on Fastify `onClose`).
- No `AbortController` usage found on fetch calls.

## Comments & docs

- Prefer short JSDoc (one or two lines) on functions and notable blocks: purpose at a high level.
- Inline comments for protocol quirks (SSE CONNECTING vs CLOSED; decision attribution).
- **TODO/FIXME:** none in committed `*.ts` / `*.tsx` / `*.md` sources searched.

## Formatting

Root `.prettierrc`: 2-space indent, double quotes, semicolons, trailing commas (`all`), print width 80. `.prettierignore` excludes `node_modules`, `dist`, `build`, `coverage`, `data`, `package-lock.json`, `.pi`, `.agents`, and `*.md`. Scripts: `npm run format` (`prettier --write .`), `npm run format:check`. `.git-blame-ignore-revs` skips the wholesale format commit so blame keeps original authors.

| Rule | Value |
|------|-------|
| Indent | 2 spaces |
| Quotes | Double quotes |
| Semicolons | Yes |
| Trailing commas | All |
| Print width | 80 |
| Modules | ESM (`"type": "module"`); server/shared use `.js` extensions in relative imports |
| Path aliases | Web: `@/*` → `apps/web/src/*` (Vite + tsconfig); server/shared use relative imports |

No ESLint config committed.

## UI / CSS conventions

- **Design authority:** `apps/web/DESIGN.md` (Quiet Dark). YAML tokens and hand-written prose win over generated shadcn kit defaults; see root `AGENTS.md`.
- Theme CSS variables on `:root` / `.dark` in `styles.css` (shadcn slots such as `--primary` for brand gold, plus flavor extras `--fg-soft`, `--border-strong`, `--ease`).
- Components use Tailwind utility classes and shadcn primitives under `components/ui/`; class merging via `cn` from `@/lib/utils`.
- Shared timer class maps live in `timer/timerDisplay.ts` (not CSS modules).
- Fonts: Instrument Serif + Inter Variable + JetBrains Mono Variable via `@fontsource*` imports in `styles.css`.

## TypeScript

- `strict: true` across packages.
- Web: `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`, bundler resolution.
- Server/shared: `NodeNext` module resolution; server build excludes tests.
