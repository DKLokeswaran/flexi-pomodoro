import {
  parseDebugFlags,
  type DebugFeatureId,
  type DebugFlags,
} from "@flexi-pomodoro/shared";
import {
  createFlagStore,
  type FlagStoreState,
} from "../createFlagStore";
import { readStoredRecord } from "../readStoredRecord";

const STORAGE_KEY = "flexi-pomodoro:debugFlags";

const DEFAULT_STATE: FlagStoreState<DebugFlags> = {
  gateEnabled: false,
  flags: {},
};

/** On-disk JSON written to localStorage. */
type DebugFlagsStored = {
  debugMode: boolean;
  flags: DebugFlags;
};

/** Untrusted on-disk JSON (fields optional; `flags` validated via `parseDebugFlags`). */
type DebugFlagsStoredInput = {
  debugMode?: boolean;
  flags?: unknown;
};

function serialize(state: FlagStoreState<DebugFlags>): DebugFlagsStored {
  return {
    debugMode: state.gateEnabled,
    flags: state.flags,
  };
}

/** Load debug mode + feature flags; ignore corrupt data. */
function loadState(): FlagStoreState<DebugFlags> {
  try {
    const parsed = readStoredRecord<DebugFlagsStoredInput>(STORAGE_KEY);
    if (!parsed) return DEFAULT_STATE;
    const gateEnabled = parsed.debugMode === true;
    const flags = parseDebugFlags(parsed.flags ?? {});
    return { gateEnabled, flags: gateEnabled ? flags : {} };
  } catch {
    return DEFAULT_STATE;
  }
}

const store = createFlagStore<DebugFeatureId, DebugFlags>({
  storageKey: STORAGE_KEY,
  hasGate: true,
  loadState,
  serialize,
  hookName: "useDebugFlags",
});

/** Browser-local debug mode and per-feature flags, synced across tabs. */
export const DebugFlagsProvider = store.Provider;

/** Access debug flags; must be rendered under DebugFlagsProvider. */
export function useDebugFlags() {
  const {
    gateEnabled: debugMode,
    setGateEnabled: setDebugMode,
    flags,
    setFlag,
    isEnabled,
  } = store.useFlagStore();
  return { debugMode, setDebugMode, flags, setFlag, isEnabled };
}
