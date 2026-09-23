import type { Settings } from "@flexi-pomodoro/shared";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import type { SettingsStore } from "../../db/stores/settingsStore.js";

/** In-memory SettingsStore double for SettingsService unit tests. */
export function createMockSettingsStore(
  initial: Settings | null = { ...DEFAULT_SETTINGS },
): SettingsStore & {
  saved: Settings[];
  loadCalls: number;
  ensureSeededCalls: number;
} {
  let row: Settings | null = initial ? { ...initial } : null;
  const saved: Settings[] = [];
  const store = {
    saved,
    loadCalls: 0,
    ensureSeededCalls: 0,
    async load(): Promise<Settings | null> {
      store.loadCalls += 1;
      return row ? { ...row } : null;
    },
    async save(settings: Settings): Promise<void> {
      row = { ...settings };
      saved.push({ ...settings });
    },
    async ensureSeeded(defaults: Settings = DEFAULT_SETTINGS): Promise<Settings> {
      store.ensureSeededCalls += 1;
      if (row) return { ...row };
      row = { ...defaults };
      saved.push({ ...row });
      return { ...row };
    },
  };
  return store;
}
