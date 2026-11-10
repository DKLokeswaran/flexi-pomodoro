import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Phase, SessionLiveStats } from "@flexi-pomodoro/shared";
import { fetchTodayStats } from "./analytics.api";
import {
  EMPTY_TODAY_STATS,
  openPhaseProgressClippedToDay,
  todayDisplayStats,
} from "../utils/todayStats";

export const todayStatsQueryKey = ["analytics", "today"] as const;

/** Closed-phase today totals from the server (day bounds from settings timezone). */
function useTodayStatsQuery() {
  return useQuery({
    queryKey: todayStatsQueryKey,
    queryFn: fetchTodayStats,
    refetchOnWindowFocus: true,
  });
}

/** Stable key so SSE / pause transitions refetch closed today totals. */
function openPhaseRefetchKey(phase: Phase | null): string {
  if (!phase) return "idle";
  const paused =
    phase.kind === "planned_work" && phase.paused ? ":paused" : "";
  return `${phase.kind}:${phase.startedAt}${paused}`;
}

/**
 * Today row values: server closed totals + open-phase clip to the response day
 * window. Refetches on phase change, day roll, and (via the query) window focus.
 */
export function useTodayDisplayStats(
  phase: Phase | null,
  nowMs: number,
): SessionLiveStats {
  const queryClient = useQueryClient();
  const query = useTodayStatsQuery();
  const data = query.data;
  const phaseKey = openPhaseRefetchKey(phase);
  const rolledPastDayEnd = useRef<string | null>(null);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: todayStatsQueryKey });
  }, [phaseKey, queryClient]);

  useEffect(() => {
    if (!data) return;
    if (nowMs < Date.parse(data.dayEnd)) return;
    if (rolledPastDayEnd.current === data.dayEnd) return;
    rolledPastDayEnd.current = data.dayEnd;
    void queryClient.invalidateQueries({ queryKey: todayStatsQueryKey });
  }, [nowMs, data, queryClient]);

  if (!data) return EMPTY_TODAY_STATS;

  const open = phase
    ? openPhaseProgressClippedToDay(phase, data.dayStart, data.dayEnd, nowMs)
    : EMPTY_TODAY_STATS;
  return todayDisplayStats(data, open);
}
