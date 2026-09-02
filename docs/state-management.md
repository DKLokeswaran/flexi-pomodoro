# State Management

## Overview

| Layer | Mechanism |
|-------|-----------|
| Server session/settings | In-memory service singletons (per process) |
| Server → clients | SSE snapshots + REST |
| Client server cache | TanStack React Query (`settings`, `health`) |
| Client live session | `useState` in `useSessionStream` (not React Query) |
| Client preferences | `localStorage` via providers/stores |
| Client UI chrome | Local `useState` (tab, drafts, accordion) |

There is **no** Redux, Zustand, Jotai, or Recoil in committed history.

---

## React Query

Configured in `main.tsx`:

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})
```

| Key | Hook | Fn | Notes |
|-----|------|-----|-------|
| `["settings"]` | `useSettingsQuery` | `fetchSettings` | Default staleTime 30s |
| `["health"]` | `useHealthQuery` | `fetchHealth` | `staleTime: Infinity` |

### Mutations

| Hook | Side effects |
|------|----------------|
| `useSaveSettingsMutation` | `setQueryData(settings)`; success/error toast |
| `useSessionActionMutation` | Calls `onSnapshot`; `playAlerts`; success toast keyed by path |

Session live state is **not** stored in the query cache; mutations push into the stream state via `setSnapshot`.

---

## Context providers

### `DebugFlagsProvider` (`browserFlags/debug`)

**Storage key:** `flexi-pomodoro:debugFlags`

**Value shape:**

```ts
{
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  flags: DebugFlags;           // e.g. { shortDurations?: boolean }
  setFlag: (id, enabled) => void;
  isEnabled: (id) => boolean;  // debugMode && flags[id]
}
```

- Built with `createFlagStore({ hasGate: true })`; server contract validated via shared `parseDebugFlags`.
- Disabling debug mode clears flags.
- Cross-tab sync via `storage` event.
- Consumed by `SettingsTab`, `IdleStartForm`.

### `UiFlagsProvider` (`browserFlags/ui`)

**Storage key:** `flexi-pomodoro:uiFlags` (shape `{ flags: { … } }`)

**Value shape:**

```ts
{
  flags: UiFlags;              // e.g. { hideContinueButton?: boolean }
  setFlag: (id, enabled) => void;
  isEnabled: (id) => boolean;  // always gate-on (hasGate: false)
}
```

- Plain TypeScript catalog (no Zod). Preferences always visible in Settings → **Browser preferences**.
- `hideContinueButton` omits Continue during the work-decision phase in `ActiveTimer`.
- Consumed by `SettingsTab`, `ActiveTimer`.

### `ToastProvider`

**Value:** `{ pushToast: (toast: { kind: "success"|"error"; message: string }) => void }`

Single toast at a time; auto-dismiss 3500ms. Consumed by About diagnostics copy, settings save, session actions.

---

## Session stream state

`useSessionStream`:

| State | Type | Role |
|-------|------|------|
| `snapshot` | `SessionSnapshot \| null` | Latest SSE/poll/mutation result |
| `setSnapshot` | setter | Exposed for optimistic/mutation updates |

Effects:

1. `connectSessionStream` → on message: set snapshot + `playAlerts`.
2. Transition active → idle → `syncAlertSeq()`.

Transport (`connectSessionStream`):

- Sync alert seq, open `EventSource` with `?sinceSeq=`
- Immediate poll + 5-minute interval poll
- Poll on `window` focus and `visibilitychange` → visible
- On `EventSource.CLOSED`, reopen (avoids fighting browser CONNECTING retry)

---

## LocalStorage stores

| Key | Module | Data |
|-----|--------|------|
| `flexi-pomodoro:lastPlayedAlertSeq` | `AlertSeqStore` | number watermark |
| `flexi-pomodoro:debugFlags` | `browserFlags/debug` | `{ debugMode, flags }` |
| `flexi-pomodoro:uiFlags` | `browserFlags/ui` | `{ flags }` |

`AlertSeqStore` methods: `get()`, `set(seq)` (may decrease on sync), `advance(seq)` (monotonic).

---

## Component-local state examples

| Component | State |
|-----------|-------|
| `App` | `tab: Tab` |
| `SettingsTab` | draft minutes/cycles/decision; `enableHardPause`; session-only `experimentalMode` gate; UI + debug flag toggles |
| `IdleStartForm` | override draft (min or sec depending on shortDurations) |
| `AboutAccordion` | `open` |
| `ToastProvider` | current toast |
| `useNow` | `now` ms ticker when active |

---

## Selectors / derived state

No dedicated selector library. Inline derivation examples:

- `App`: `sessionIsActive = snapshot?.status === "active"`; settings fallback `DEFAULT_SETTINGS`
- `ActiveTimer`: `displayClock`, `actionsForPhase` (reads `hideContinueButton` via `useUiFlags`), `phaseHint`, `liveStatsAt` HUD, strategy-aware pause labels
- `AboutTab`: feature available/soon counts; health UI mapping

---

## Custom state hooks

| Hook | Inputs | Outputs |
|------|--------|---------|
| `useNow(isTicking)` | boolean | `number` (Date.now, 250ms) |
| `useSessionStream()` | — | `{ snapshot, setSnapshot }` |
| `useDebugFlags()` | — | debug flag store (throws if missing) |
| `useUiFlags()` | — | UI preference store (throws if missing) |
| `useToast()` | — | `{ pushToast }` |
| `useSettingsQuery` / mutations | — | React Query results |
| `useHealthQuery` | — | React Query result |
