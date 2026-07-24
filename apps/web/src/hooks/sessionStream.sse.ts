import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { fetchSession } from "../queries/session.api";
import { syncAlertSeq } from "../utils/alertSeq";
import { alertSeqStore } from "../utils/alertSeqStore";

export type SessionListener = (snapshot: SessionSnapshot) => void;

/**
 * Hybrid transport: SSE for live transitions + 5-minute poll fallback.
 * Local countdown uses wall-clock anchors (no sub-second API polling).
 */
export function connectSessionStream(onSnapshot: SessionListener): () => void {
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const poll = async () => {
    try {
      onSnapshot(await fetchSession());
    } catch {
      // ignore transient errors
    }
  };

  const openSse = async () => {
    if (closed) return;
    try {
      await syncAlertSeq();
    } catch {
      // ignore transient errors; reconnect will retry
    }
    if (closed) return;
    const sinceSeq = alertSeqStore.get();
    const q = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
    es = new EventSource(`${SESSION_API.events}${q}`);
    es.onmessage = (ev) => {
      try {
        onSnapshot(JSON.parse(ev.data) as SessionSnapshot);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // CONNECTING = browser auto-retry; only handle a fully closed stream.
      if (es?.readyState !== EventSource.CLOSED) return;
      es = null;
      if (closed) return;
      void openSse();
    };
  };

  void openSse();
  void poll();
  pollTimer = setInterval(poll, 5 * 60_000);

  const onFocus = () => {
    void poll();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void poll();
  });

  return () => {
    closed = true;
    es?.close();
    if (pollTimer) clearInterval(pollTimer);
    window.removeEventListener("focus", onFocus);
  };
}
