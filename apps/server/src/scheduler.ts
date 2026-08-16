/**
 * Modular clock driver. IntervalScheduler is the M1 default;
 * swap for a deadline-based scheduler later without touching the engine.
 */
export interface Scheduler {
  start(): void;
  stop(): void;
}

export interface IntervalSchedulerOptions {
  intervalMs: number;
  onTick: (nowMs: number) => void;
  now?: () => number;
}

/** Periodic setInterval driver; unrefs so it does not keep the process alive. */
export class IntervalScheduler implements Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: IntervalSchedulerOptions) {}

  /** Begin polling onTick at intervalMs; no-op if already running. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.options.onTick(this.options.now?.() ?? Date.now());
    }, this.options.intervalMs);
    this.timer.unref?.();
  }

  /** Stop the interval if one is running. */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
