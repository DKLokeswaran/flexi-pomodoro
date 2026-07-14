import type {
  AlertEvent,
  AlertId,
  SessionOverrides,
  SessionSnapshot,
  Settings,
  SettingsPatch,
} from "@flexi-pomodoro/shared";

const ALERT_SEQ_KEY = "flexi-pomodoro:lastPlayedAlertSeq";

/** In-memory watermark — always authoritative for this tab session. */
let memorySeq = 0;

function readStoredSeq(): number {
  try {
    const raw = localStorage.getItem(ALERT_SEQ_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function getLastPlayedSeq(): number {
  const fromLs = readStoredSeq();
  memorySeq = Math.max(memorySeq, fromLs);
  return memorySeq;
}

export function setLastPlayedSeq(seq: number): void {
  memorySeq = Math.max(memorySeq, seq);
  try {
    localStorage.setItem(ALERT_SEQ_KEY, String(memorySeq));
  } catch {
    // Quota / private mode: memorySeq still drives sinceSeq for this tab.
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchSettings(): Promise<Settings> {
  return parseJson(await fetch("/api/settings"));
}

export async function saveSettings(partial: SettingsPatch): Promise<Settings> {
  return parseJson(
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }),
  );
}

export async function fetchSession(): Promise<SessionSnapshot> {
  const sinceSeq = getLastPlayedSeq();
  const q = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
  return parseJson(await fetch(`/api/session${q}`));
}

export async function postAction(
  path: string,
  body?: SessionOverrides | undefined,
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

  const openSse = () => {
    if (closed) return;
    const sinceSeq = getLastPlayedSeq();
    const q = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
    es = new EventSource(`/api/session/events${q}`);
    es.onmessage = (ev) => {
      try {
        onSnapshot(JSON.parse(ev.data) as SessionSnapshot);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      if (!closed) setTimeout(openSse, 2_000);
    };
  };

  openSse();
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
 * Play new alert deltas. Autoplay may still fail without a recent user gesture;
 * failures are ignored — visual state remains correct.
 */
export function playAlerts(events: AlertEvent[]): void {
  if (events.length === 0) return;
  const last = getLastPlayedSeq();
  const fresh = events.filter((e) => e.seq > last);
  if (fresh.length === 0) return;
  setLastPlayedSeq(Math.max(...fresh.map((e) => e.seq)));
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
