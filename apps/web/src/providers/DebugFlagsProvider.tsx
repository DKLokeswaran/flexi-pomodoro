import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DebugFlagsSchema,
  isDebugFeatureEnabled,
  type DebugFeatureId,
  type DebugFlags,
} from "@flexi-pomodoro/shared";

const STORAGE_KEY = "flexi-pomodoro:debugFlags";

type PersistedDebugPrefs = {
  debugMode: boolean;
  flags: DebugFlags;
};

const DEFAULT_PREFS: PersistedDebugPrefs = { debugMode: false, flags: {} };

/** Load debug mode + feature flags from localStorage; ignore corrupt data. */
function readPersisted(): PersistedDebugPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return DEFAULT_PREFS;
    const parsed = data as Record<string, unknown>;
    const debugMode = parsed.debugMode === true;
    const flags = DebugFlagsSchema.parse(parsed.flags ?? {});
    return { debugMode, flags: debugMode ? flags : {} };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Persist prefs; swallow quota / private-mode failures. */
function writePersisted(prefs: PersistedDebugPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota / private mode: in-memory state still drives this tab.
  }
}

type DebugFlagsContextValue = {
  /** Global gate — feature list and effects only apply when true. */
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  flags: DebugFlags;
  setFlag: (featureId: DebugFeatureId, enabled: boolean) => void;
  /** True only when debugMode is on and the feature flag is set. */
  isEnabled: (featureId: DebugFeatureId) => boolean;
};

const DebugFlagsContext = createContext<DebugFlagsContextValue | null>(null);

/** Browser-local debug mode and per-feature flags, synced across tabs. */
export function DebugFlagsProvider({ children }: { children: ReactNode }) {
  const [initialPrefs] = useState(readPersisted);
  const [debugMode, setDebugModeState] = useState(initialPrefs.debugMode);
  const [flags, setFlags] = useState(initialPrefs.flags);

  useEffect(() => {
    writePersisted({ debugMode, flags });
  }, [debugMode, flags]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = readPersisted();
      setDebugModeState(next.debugMode);
      setFlags(next.flags);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Enable/disable debug mode; clearing the gate also clears feature flags. */
  const setDebugMode = (enabled: boolean) => {
    setDebugModeState(enabled);
    if (!enabled) {
      setFlags({});
    }
  };

  /** Set or clear one feature flag while debug mode is on. */
  const setFlag = (featureId: DebugFeatureId, enabled: boolean) => {
    if (!debugMode) return;
    setFlags((previousFlags) => {
      const nextFlags = { ...previousFlags };
      if (enabled) {
        nextFlags[featureId] = true;
      } else {
        delete nextFlags[featureId];
      }
      return nextFlags;
    });
  };

  /** True only when debugMode is on and the feature flag is set. */
  const isEnabled = (featureId: DebugFeatureId) =>
    debugMode && isDebugFeatureEnabled(flags, featureId);

  return (
    <DebugFlagsContext.Provider
      value={{ debugMode, setDebugMode, flags, setFlag, isEnabled }}
    >
      {children}
    </DebugFlagsContext.Provider>
  );
}

/** Access debug flags; must be rendered under DebugFlagsProvider. */
export function useDebugFlags(): DebugFlagsContextValue {
  const context = useContext(DebugFlagsContext);
  if (!context) {
    throw new Error("useDebugFlags must be used within DebugFlagsProvider");
  }
  return context;
}
