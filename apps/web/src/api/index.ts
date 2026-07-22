import type {
  AlertEvent,
  AlertId,
  SessionSnapshot,
  Settings,
  SettingsPatch,
  StartSessionBody,
} from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { alertSeqStore } from "../utils/alertSeqStore";
import { REQUEST_FAILED } from "../constants/labels";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `${REQUEST_FAILED} (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchSettings(): Promise<Settings> {
  return parseJson(await fetch(SESSION_API.settings));
}

export async function fetchHealth(): Promise<{ ok: boolean }> {
  return parseJson(await fetch(SESSION_API.health));
}

export async function saveSettings(partial: SettingsPatch): Promise<Settings> {
  return parseJson(
    await fetch(SESSION_API.settings, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }),
  );
}

export async function fetchAlertSeq(): Promise<number> {
  const body = await parseJson<{ alertSeq: number }>(
    await fetch(SESSION_API.alertSeq),
  );
  return body.alertSeq;
}

/** Align client watermark with server high-water (no history replay). */
export async function syncAlertSeq(): Promise<number> {
  const seq = await fetchAlertSeq();
  alertSeqStore.set(seq);
  return seq;
}

export async function fetchSession(): Promise<SessionSnapshot> {
  const sinceSeq = alertSeqStore.get();
  const q = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
  return parseJson(await fetch(`${SESSION_API.session}${q}`));
}

export async function postAction(
  path: string,
  body?: StartSessionBody | undefined,
): Promise<SessionSnapshot> {
  return parseJson(
    await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

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

const ALERT_FILES: Record<AlertId, string> = {
  work_planned_end: "/alerts/placeholder-work_planned_end.wav",
  rest_ack: "/alerts/placeholder-rest_ack.wav",
  short_rest_start: "/alerts/placeholder-short_rest_start.wav",
  long_rest_start: "/alerts/placeholder-long_rest_start.wav",
  short_rest_end: "/alerts/placeholder-short_rest_end.wav",
  long_rest_end: "/alerts/placeholder-long_rest_end.wav",
  extended_work_auto_start: "/alerts/placeholder-extended_work_auto_start.wav",
};

/**
 * Play new alert deltas. Autoplay may fail without a recent user gesture;
 * failures are ignored — visual state remains correct.
 */
export function playAlerts(events: AlertEvent[]): void {
  if (events.length === 0) return;
  const last = alertSeqStore.get();
  const fresh = events.filter((e) => e.seq > last);
  if (fresh.length === 0) return;
  alertSeqStore.advance(Math.max(...fresh.map((e) => e.seq)));
  for (const event of fresh) {
    const src = ALERT_FILES[event.id];
    if (!src) continue;
    const audio = new Audio(src);
    void audio.play().catch(() => {
      // Autoplay blocked — visual state is enough.
    });
  }
}

export function alertsFromSnapshot(snapshot: SessionSnapshot): AlertEvent[] {
  if (snapshot.status === "idle") return snapshot.pendingAlerts;
  return snapshot.session.pendingAlerts;
}
