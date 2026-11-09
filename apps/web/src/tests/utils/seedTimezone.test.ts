import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS, type Settings } from "@flexi-pomodoro/shared";
import {
  TZ_SEEDED_KEY,
  seedTimezoneIfNeeded,
} from "../../utils/seedTimezone.ts";

/** Minimal localStorage stand-in for node:test (no browser globals). */
function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("seedTimezoneIfNeeded", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("PUTs browser zone once when settings are still UTC", async () => {
    installMemoryLocalStorage();
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz === "UTC") {
      // Environment is UTC — seed is a no-op by design; only gate is set.
      const saves: unknown[] = [];
      await seedTimezoneIfNeeded(DEFAULT_SETTINGS, async (patch) => {
        saves.push(patch);
        return { ...DEFAULT_SETTINGS, ...patch };
      });
      assert.equal(saves.length, 0);
      assert.equal(localStorage.getItem(TZ_SEEDED_KEY), "1");
      return;
    }

    const saves: unknown[] = [];
    const first = await seedTimezoneIfNeeded(
      DEFAULT_SETTINGS,
      async (patch) => {
        saves.push(patch);
        return { ...DEFAULT_SETTINGS, ...patch };
      },
    );
    assert.deepEqual(saves, [{ timezone: browserTz }]);
    assert.equal(first?.timezone, browserTz);
    assert.equal(localStorage.getItem(TZ_SEEDED_KEY), "1");

    const second = await seedTimezoneIfNeeded(
      { ...DEFAULT_SETTINGS, timezone: "UTC" },
      async (patch) => {
        saves.push(patch);
        return { ...DEFAULT_SETTINGS, ...patch };
      },
    );
    assert.equal(second, null);
    assert.equal(saves.length, 1);
  });

  it("does not overwrite a non-UTC stored timezone", async () => {
    installMemoryLocalStorage();
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      timezone: "Europe/London",
    };
    const saves: unknown[] = [];
    await seedTimezoneIfNeeded(settings, async (patch) => {
      saves.push(patch);
      return { ...settings, ...patch };
    });
    assert.equal(saves.length, 0);
    assert.equal(localStorage.getItem(TZ_SEEDED_KEY), "1");
  });
});
