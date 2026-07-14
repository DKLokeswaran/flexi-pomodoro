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

export class IntervalScheduler implements Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: IntervalSchedulerOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.opts.onTick(this.opts.now?.() ?? Date.now());
    }, this.opts.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
