import {
  type Settings,
  DEFAULT_SETTINGS,
  SettingsSchema,
} from "@flexi-pomodoro/shared";
import type { Knex } from "knex";

const SETTINGS_ROW_ID = 1;

type SettingsRow = Settings & { id: number; updatedAt: string };

/** Persist and load the singleton settings row. */
export class SettingsStore {
  constructor(private readonly db: Knex) {}

  /** Load persisted settings, or null if the singleton row is missing. */
  async load(): Promise<Settings | null> {
    const row = await this.db<SettingsRow>("settings")
      .where({ id: SETTINGS_ROW_ID })
      .first();
    if (!row) return null;
    return SettingsSchema.parse({
      workDurationSec: row.workDurationSec,
      shortRestDurationSec: row.shortRestDurationSec,
      cyclesBeforeLongRest: row.cyclesBeforeLongRest,
      longRestDurationSec: row.longRestDurationSec,
      decisionWindowSec: row.decisionWindowSec,
      alertsMuted: Boolean(row.alertsMuted),
      workPauseStrategy: row.workPauseStrategy,
    });
  }

  /** Upsert the singleton settings row (defaults used only for typing completeness). */
  async save(settings: Settings, updatedAtMs: number = Date.now()): Promise<void> {
    const payload = {
      id: SETTINGS_ROW_ID,
      workDurationSec: settings.workDurationSec,
      shortRestDurationSec: settings.shortRestDurationSec,
      cyclesBeforeLongRest: settings.cyclesBeforeLongRest,
      longRestDurationSec: settings.longRestDurationSec,
      decisionWindowSec: settings.decisionWindowSec,
      alertsMuted: settings.alertsMuted,
      workPauseStrategy: settings.workPauseStrategy,
      updatedAt: new Date(updatedAtMs).toISOString(),
    };
    const existing = await this.db("settings")
      .where({ id: SETTINGS_ROW_ID })
      .first();
    if (existing) {
      await this.db("settings").where({ id: SETTINGS_ROW_ID }).update(payload);
      return;
    }
    await this.db("settings").insert(payload);
  }

  /** Ensure a settings row exists; seed DEFAULT_SETTINGS when empty. */
  async ensureSeeded(
    defaults: Settings = DEFAULT_SETTINGS,
  ): Promise<Settings> {
    const loaded = await this.load();
    if (loaded) return loaded;
    await this.save(defaults);
    return defaults;
  }
}
