import type { Settings, SettingsPatch } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { parseJson } from "../utils/fetchJson";

export async function fetchSettings(): Promise<Settings> {
  return parseJson(await fetch(SESSION_API.settings));
}

export async function saveSettings(partial: SettingsPatch): Promise<Settings> {
  return parseJson(
    await fetch(SESSION_API.settings, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }),
  );
}
