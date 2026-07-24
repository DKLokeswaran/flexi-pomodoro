import {
  type DebugFlags,
  type SessionOverrides,
  type SessionParams,
  type Settings,
  type SettingsPatch,
  DEFAULT_SETTINGS,
  mergeSessionParams,
  parseSettingsPatch,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";

export class SettingsError extends Error {
  constructor(
    message: string,
    readonly code: string = "INVALID_SETTINGS",
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

export function toSettingsError(err: unknown): SettingsError {
  if (err instanceof SettingsError) return err;
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => i.message).join("; ") || "Invalid input";
    return new SettingsError(msg, "INVALID_SETTINGS");
  }
  throw err;
}

export class SettingsService {
  private settings: Settings = { ...DEFAULT_SETTINGS };

  get(): Settings {
    return { ...this.settings };
  }

  update(partial: SettingsPatch): Settings {
    try {
      this.settings = parseSettingsPatch(this.settings, partial);
    } catch (err) {
      throw toSettingsError(err);
    }
    return this.get();
  }

  resolveSessionParams(
    overrides?: SessionOverrides,
    debug?: DebugFlags,
  ): SessionParams {
    try {
      return mergeSessionParams(this.settings, overrides, { debug });
    } catch (err) {
      throw toSettingsError(err);
    }
  }
}
