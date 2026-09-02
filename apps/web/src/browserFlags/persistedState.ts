import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Persist React state in localStorage and sync across browser tabs.
 *
 * `loadState` is a function (not a value) because it must be callable again
 * when another tab writes to the same key.
 * `serialize` controls the JSON shape written (defaults to the state itself).
 */
export function usePersistedState<T>(
  storageKey: string,
  loadState: () => T,
  serialize: (state: T) => unknown = (state) => state,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(serialize(state)));
    } catch {
      // Quota / private mode: in-memory state still drives this tab.
    }
  }, [storageKey, state, serialize]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      setState(loadState());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, loadState]);

  return [state, setState];
}
