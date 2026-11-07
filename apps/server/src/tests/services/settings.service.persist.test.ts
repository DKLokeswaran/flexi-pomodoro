import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import { SettingsService } from "../../services/settings.service.js";
import { openTempDatabase } from "../helpers/tempDatabase.js";

describe("SettingsService persist across restart", () => {
  const disposers: Array<() => Promise<void>> = [];

  after(async () => {
    while (disposers.length > 0) {
      await disposers.pop()!();
    }
  });

  it("hydrate after new service instance loads saved settings", async () => {
    const ctx = await openTempDatabase();
    disposers.push(ctx.dispose);

    const first = new SettingsService(ctx.stores.settings);
    await first.hydrate();
    assert.deepEqual(first.get(), DEFAULT_SETTINGS);

    await first.update({
      workDurationSec: 30 * 60,
      workPauseStrategy: "hard",
      alertsMuted: true,
      decisionWindowSec: 20,
    });

    const second = new SettingsService(ctx.stores.settings);
    await second.hydrate();
    const loaded = second.get();
    assert.equal(loaded.workDurationSec, 30 * 60);
    assert.equal(loaded.workPauseStrategy, "hard");
    assert.equal(loaded.alertsMuted, true);
    assert.equal(loaded.decisionWindowSec, 20);
  });
});
