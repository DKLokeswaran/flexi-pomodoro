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

function readPersisted(): PersistedDebugPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return DEFAULT_PREFS;
    const obj = data as Record<string, unknown>;
    const debugMode = obj.debugMode === true;
    const flags = DebugFlagsSchema.parse(obj.flags ?? {});
    return { debugMode, flags: debugMode ? flags : {} };
  } catch {
    return DEFAULT_PREFS;
  }
}

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
  setFlag: (id: DebugFeatureId, enabled: boolean) => void;
  /** True only when debugMode is on and the feature flag is set. */
  isEnabled: (id: DebugFeatureId) => boolean;
};

const DebugFlagsContext = createContext<DebugFlagsContextValue | null>(null);

export function DebugFlagsProvider({ children }: { children: ReactNode }) {
  const [initialPrefs] = useState(readPersisted);
  const [debugMode, setDebugModeState] = useState(initialPrefs.debugMode);
  const [flags, setFlags] = useState(initialPrefs.flags);

  useEffect(() => {
    writePersisted({ debugMode, flags });
  }, [debugMode, flags]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY && ev.key !== null) return;
      const next = readPersisted();
      setDebugModeState(next.debugMode);
      setFlags(next.flags);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDebugMode = (enabled: boolean) => {
    setDebugModeState(enabled);
    if (!enabled) {
      setFlags({});
    }
  };

  const setFlag = (id: DebugFeatureId, enabled: boolean) => {
    if (!debugMode) return;
    setFlags((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const isEnabled = (id: DebugFeatureId) =>
    debugMode && isDebugFeatureEnabled(flags, id);

  return (
    <DebugFlagsContext.Provider
      value={{ debugMode, setDebugMode, flags, setFlag, isEnabled }}
    >
      {children}
    </DebugFlagsContext.Provider>
  );
}

export function useDebugFlags(): DebugFlagsContextValue {
  const ctx = useContext(DebugFlagsContext);
  if (!ctx) {
    throw new Error("useDebugFlags must be used within DebugFlagsProvider");
  }
  return ctx;
}
