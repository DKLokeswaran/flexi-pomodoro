import type { Settings, SettingsPatch } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { parseJson } from "../utils/fetchJson";

/** GET persisted session defaults. */
export async function fetchSettings(): Promise<Settings> {
  return parseJson(await fetch(SESSION_API.settings));
}

/** PUT a settings patch and return the saved defaults. */
export async function saveSettings(partial: SettingsPatch): Promise<Settings> {
  return parseJson(
    await fetch(SESSION_API.settings, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }),
  );
}
