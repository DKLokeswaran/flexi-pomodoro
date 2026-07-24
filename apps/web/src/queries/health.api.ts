import { SESSION_API } from "@flexi-pomodoro/shared";
import { parseJson } from "../utils/fetchJson";

export async function fetchHealth(): Promise<{ ok: boolean }> {
  return parseJson(await fetch(SESSION_API.health));
}
