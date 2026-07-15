import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { DebugFeatureId, DebugFlags } from "@flexi-pomodoro/shared";
import { isDebugFeatureEnabled } from "@flexi-pomodoro/shared";

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
  const [debugMode, setDebugModeState] = useState(false);
  const [flags, setFlags] = useState<DebugFlags>({});

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
