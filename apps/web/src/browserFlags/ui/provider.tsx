import {
  readUiFlags,
  type UiFeatureId,
  type UiFlags,
} from "./catalog";
import {
  createFlagStore,
  type FlagStoreState,
} from "../createFlagStore";
import { readStoredRecord } from "../readStoredRecord";

const STORAGE_KEY = "flexi-pomodoro:uiFlags";

const DEFAULT_STATE: FlagStoreState<UiFlags> = {
  gateEnabled: true,
  flags: {},
};

/** On-disk JSON written to localStorage. */
type UiFlagsStored = {
  flags: UiFlags;
};

/** Untrusted on-disk JSON (validated via `readUiFlags`). */
type UiFlagsStoredInput = {
  flags?: Record<string, unknown>;
};

function serialize(state: FlagStoreState<UiFlags>): UiFlagsStored {
  return { flags: state.flags };
}

/** Load UI flags from `{ flags: { ... } }`; ignore corrupt data. */
function loadState(): FlagStoreState<UiFlags> {
  const parsed = readStoredRecord<UiFlagsStoredInput>(STORAGE_KEY);
  if (!parsed?.flags) {
    return DEFAULT_STATE;
  }

  return {
    gateEnabled: true,
    flags: readUiFlags(parsed.flags),
  };
}

const store = createFlagStore<UiFeatureId, UiFlags>({
  storageKey: STORAGE_KEY,
  hasGate: false,
  loadState,
  serialize,
  hookName: "useUiFlags",
});

/** Browser-local UI feature flags (gate always on), synced across tabs. */
export const UiFlagsProvider = store.Provider;

/** Access UI flags; must be rendered under UiFlagsProvider. */
export function useUiFlags() {
  return store.useFlagStore();
}
