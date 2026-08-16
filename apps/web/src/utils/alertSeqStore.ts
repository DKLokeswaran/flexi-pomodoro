const ALERT_SEQ_KEY = "flexi-pomodoro:lastPlayedAlertSeq";

/** Read a persisted sequence, or 0 if missing/invalid/unavailable. */
function readStoredSeq(): number {
  try {
    const storedValue = localStorage.getItem(ALERT_SEQ_KEY);
    const parsedSeq = storedValue ? Number(storedValue) : 0;
    return Number.isFinite(parsedSeq) && parsedSeq >= 0
      ? Math.floor(parsedSeq)
      : 0;
  } catch {
    return 0;
  }
}

/** Client watermark for alert delivery; may snap down via sync. */
export class AlertSeqStore {
  private memorySeq = 0;

  constructor() {
    this.memorySeq = readStoredSeq();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key !== ALERT_SEQ_KEY && event.key !== null) return;
        const stored = readStoredSeq();
        if (stored !== this.memorySeq) {
          this.memorySeq = stored;
        }
      });
    }
  }

  /** Current watermark (in-memory, initialized from localStorage). */
  get(): number {
    return this.memorySeq;
  }

  /** Set watermark to server value — may decrease (sync / idle). */
  set(seq: number): void {
    const next = Number.isFinite(seq) && seq >= 0 ? Math.floor(seq) : 0;
    this.memorySeq = next;
    try {
      localStorage.setItem(ALERT_SEQ_KEY, String(next));
    } catch {
      // Quota / private mode: in-memory still drives sinceSeq for this tab.
    }
  }

  /** Advance watermark after playing alerts (monotonic only). */
  advance(seq: number): void {
    if (seq <= this.memorySeq) return;
    this.set(seq);
  }
}

export const alertSeqStore = new AlertSeqStore();

/** `?sinceSeq=N` when the client watermark is positive; otherwise empty. */
export function sinceSeqQueryString(): string {
  const sinceSeq = alertSeqStore.get();
  return sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
}
