import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { FlagMap } from "./createFlagCatalog";
import { usePersistedState } from "./persistedState";

/** In-memory / logical shape shared by debug and UI flag stores. */
export type FlagStoreState<Flags extends object> = {
  gateEnabled: boolean;
  flags: Flags;
};

export type FlagStoreApi<
  FlagId extends string,
  Flags extends FlagMap<FlagId>,
> = {
  /** Global gate; always true when the store was created with `hasGate: false`. */
  gateEnabled: boolean;
  setGateEnabled: (enabled: boolean) => void;
  flags: Flags;
  setFlag: (featureId: FlagId, enabled: boolean) => void;
  isEnabled: (featureId: FlagId) => boolean;
};

type CreateFlagStoreOptions<
  FlagId extends string,
  Flags extends FlagMap<FlagId>,
> = {
  storageKey: string;
  /**
   * When true, flags only apply while the gate is on; clearing the gate
   * clears flags. When false, the gate is always on (UI flags).
   */
  hasGate: boolean;
  /** Called on mount and again when another tab updates this storage key. */
  loadState: () => FlagStoreState<Flags>;
  /** JSON payload written to localStorage (defaults to the store state). */
  serialize?: (state: FlagStoreState<Flags>) => unknown;
  /** Thrown by the hook when used outside the provider. */
  hookName: string;
};

/**
 * Shared browser flag store: catalog flags + optional global gate,
 * persisted and synced across tabs.
 */
export function createFlagStore<
  FlagId extends string,
  Flags extends FlagMap<FlagId>,
>(options: CreateFlagStoreOptions<FlagId, Flags>) {
  const {
    storageKey,
    hasGate,
    loadState,
    serialize = (state) => state,
    hookName,
  } = options;

  const StoreContext = createContext<FlagStoreApi<FlagId, Flags> | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [state, setState] = usePersistedState(
      storageKey,
      loadState,
      serialize,
    );

    const gateEnabled = hasGate ? state.gateEnabled : true;

    const setGateEnabled = useCallback(
      (enabled: boolean) => {
        if (!hasGate) return;
        setState((current) => ({
          gateEnabled: enabled,
          flags: enabled ? current.flags : ({} as Flags),
        }));
      },
      [setState],
    );

    const setFlag = useCallback(
      (featureId: FlagId, enabled: boolean) => {
        setState((current) => {
          const currentGate = hasGate ? current.gateEnabled : true;
          if (!currentGate) return current;
          const nextFlags = { ...current.flags };
          if (enabled) {
            nextFlags[featureId] = true as Flags[FlagId];
          } else {
            delete nextFlags[featureId];
          }
          return {
            gateEnabled: currentGate,
            flags: nextFlags,
          };
        });
      },
      [setState],
    );

    const isEnabled = useCallback(
      (featureId: FlagId) => gateEnabled && Boolean(state.flags[featureId]),
      [gateEnabled, state.flags],
    );

    const value = useMemo(
      () => ({
        gateEnabled,
        setGateEnabled,
        flags: state.flags,
        setFlag,
        isEnabled,
      }),
      [gateEnabled, setGateEnabled, state.flags, setFlag, isEnabled],
    );

    return (
      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
    );
  }

  function useFlagStore(): FlagStoreApi<FlagId, Flags> {
    const context = useContext(StoreContext);
    if (!context) {
      throw new Error(`${hookName} must be used within its Provider`);
    }
    return context;
  }

  return { Provider, useFlagStore };
}
