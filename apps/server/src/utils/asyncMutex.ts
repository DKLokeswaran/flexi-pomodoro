/**
 * Serializes async work so at most one critical section runs at a time.
 * Callers either await the queue or skip when the lock is already held.
 */
export class AsyncMutex {
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  /** True while a critical section is running. */
  isLocked(): boolean {
    return this.locked;
  }

  /** Run `fn` exclusively; waiters run in FIFO order. */
  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    return this.runHeld(fn);
  }

  /**
   * Run `fn` only if the lock is free. Returns null when skipped.
   * Used by the scheduler so ticks do not pile up behind a long command.
   */
  async tryRunExclusive<T>(fn: () => Promise<T> | T): Promise<T | null> {
    if (!this.tryAcquire()) return null;
    return this.runHeld(fn);
  }

  /** Caller must already hold the lock; always releases when `fn` settles. */
  private async runHeld<T>(fn: () => Promise<T> | T): Promise<T> {
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private tryAcquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  private acquire(): Promise<void> {
    if (this.tryAcquire()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        // Predecessor transferred ownership; do not clear locked.
        resolve();
      });
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.locked = false;
  }
}
