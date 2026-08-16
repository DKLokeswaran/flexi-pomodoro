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

/** Validation failure when reading or updating settings. */
export class SettingsError extends Error {
  constructor(
    message: string,
    readonly code: string = "INVALID_SETTINGS",
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

/** Convert Zod issues into SettingsError; rethrow anything else. */
export function toSettingsError(error: unknown): SettingsError {
  if (error instanceof SettingsError) return error;
  if (error instanceof ZodError) {
    const message =
      error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
    return new SettingsError(message, "INVALID_SETTINGS");
  }
  throw error;
}

/** In-memory persisted defaults used when starting a session. */
export class SettingsService {
  private settings: Settings = { ...DEFAULT_SETTINGS };

  /** Return a shallow copy of the current persisted defaults. */
  get(): Settings {
    return { ...this.settings };
  }

  /** Merge and validate a patch onto persisted defaults. */
  update(partial: SettingsPatch): Settings {
    try {
      this.settings = parseSettingsPatch(this.settings, partial);
    } catch (error) {
      throw toSettingsError(error);
    }
    return this.get();
  }

  /** Merge defaults + optional start overrides under the given debug bounds. */
  resolveSessionParams(
    overrides?: SessionOverrides,
    debug?: DebugFlags,
  ): SessionParams {
    try {
      return mergeSessionParams(this.settings, overrides, { debug });
    } catch (error) {
      throw toSettingsError(error);
    }
  }
}
