import type { SessionLiveStats } from "@flexi-pomodoro/shared";
import { formatHhMmSs } from "../../utils/time";
import { cn } from "@/lib/utils";
import { timerDisplay } from "./timerDisplay";

/** Worked / deliberation / rest / paused counters (shared by live + today). */
export function StatsCounters({
  stats,
  className,
}: {
  stats: SessionLiveStats;
  className?: string;
}) {
  return (
    <p className={cn(timerDisplay.liveStats, className)}>
      <span>
        Worked <strong>{formatHhMmSs(stats.workedSec)}</strong>
      </span>
      <span>
        Deliberation <strong>{formatHhMmSs(stats.deliberationSec)}</strong>
      </span>
      <span>
        Rest <strong>{formatHhMmSs(stats.restSec)}</strong>
      </span>
      <span>
        Paused <strong>{formatHhMmSs(stats.pausedSec)}</strong>
      </span>
    </p>
  );
}

/** Client-day totals row — separate from session live stats. */
export function TodayStatsRow({ stats }: { stats: SessionLiveStats }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="type-label text-muted-foreground">Today</p>
      <StatsCounters stats={stats} className="mt-0" />
    </div>
  );
}
