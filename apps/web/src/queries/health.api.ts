import { SESSION_API } from "@flexi-pomodoro/shared";
import { parseJson } from "../utils/fetchJson";

/** GET /api/health — used by the About tab instance section. */
export async function fetchHealth(): Promise<{ ok: boolean }> {
  return parseJson(await fetch(SESSION_API.health));
}
