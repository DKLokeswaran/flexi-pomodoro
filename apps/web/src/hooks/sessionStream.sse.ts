import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { fetchSession } from "../queries/session.api";
import { syncAlertSeq } from "../utils/alertSeq";
import { sinceSeqQueryString } from "../utils/alertSeqStore";

/** Callback that receives live session snapshots from the stream. */
export type SessionListener = (snapshot: SessionSnapshot) => void;

const POLL_INTERVAL_MS = 5 * 60_000;

/** Parse an SSE data payload; ignore malformed frames. */
function parseSnapshotMessage(raw: string): SessionSnapshot | null {
  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

/**
 * Hybrid transport: SSE for live transitions + 5-minute poll fallback.
 * Local countdown uses wall-clock anchors (no sub-second API polling).
 */
export function connectSessionStream(onSnapshot: SessionListener): () => void {
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  // Fallback poll: current snapshot, ignore transient network errors.
  const poll = async () => {
    try {
      onSnapshot(await fetchSession());
    } catch {
      // ignore transient errors
    }
  };

  // Open (or reopen) EventSource after aligning the alert watermark.
  const openSse = async () => {
    if (closed) return;
    try {
      await syncAlertSeq();
    } catch {
      // ignore transient errors; reconnect will retry
    }
    if (closed) return;
    eventSource = new EventSource(
      `${SESSION_API.events}${sinceSeqQueryString()}`,
    );
    eventSource.onmessage = (event) => {
      const snapshot = parseSnapshotMessage(event.data);
      if (snapshot) onSnapshot(snapshot);
    };
    eventSource.onerror = () => {
      // CONNECTING = browser auto-retry; only handle a fully closed stream.
      if (eventSource?.readyState !== EventSource.CLOSED) return;
      eventSource = null;
      if (closed) return;
      void openSse();
    };
  };

  void openSse();
  void poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  // Refresh on tab focus so a missed SSE event is recovered quickly.
  const onFocus = () => {
    void poll();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void poll();
  });

  return () => {
    closed = true;
    eventSource?.close();
    if (pollTimer) clearInterval(pollTimer);
    window.removeEventListener("focus", onFocus);
  };
}
