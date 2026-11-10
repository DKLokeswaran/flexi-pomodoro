import type { TodayStatsResponse } from "@flexi-pomodoro/shared";
import { ANALYTICS_API } from "@flexi-pomodoro/shared";
import { parseJson } from "../utils/fetchJson";

/** GET /api/analytics/today — closed-phase day totals + day window. */
export async function fetchTodayStats(): Promise<TodayStatsResponse> {
  return parseJson(await fetch(ANALYTICS_API.today));
}
