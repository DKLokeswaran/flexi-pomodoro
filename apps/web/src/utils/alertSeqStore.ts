const ALERT_SEQ_KEY = "flexi-pomodoro:lastPlayedAlertSeq";

function readStoredSeq(): number {
  try {
    const raw = localStorage.getItem(ALERT_SEQ_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
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
      window.addEventListener("storage", (ev) => {
        if (ev.key !== ALERT_SEQ_KEY && ev.key !== null) return;
        const stored = readStoredSeq();
        if (stored !== this.memorySeq) {
          this.memorySeq = stored;
        }
      });
    }
  }

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
