import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import { connectSessionStream } from "./sessionStream.sse";
import { syncAlertSeq } from "../utils/alertSeq";
import { alertsFromSnapshot, playAlerts } from "../utils/playAlerts";

/** Live session snapshot via SSE, plus alert playback and idle watermark sync. */
export function useSessionStream() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const prevStatusRef = useRef<SessionSnapshot["status"] | null>(null);

  /** Store the snapshot and play any new alert deltas. */
  const onSnapshot = useEffectEvent((next: SessionSnapshot) => {
    setSnapshot(next);
    playAlerts(alertsFromSnapshot(next));
  });

  /** After active → idle, snap the alert watermark to the server high-water. */
  const onIdle = useEffectEvent(async () => {
    try {
      await syncAlertSeq();
    } catch {
      // ignore transient errors; reconnect or next idle will retry
    }
  });

  useEffect(() => {
    return connectSessionStream((next) => onSnapshot(next));
  }, []);

  useEffect(() => {
    const status = snapshot?.status ?? null;
    if (prevStatusRef.current === "active" && status === "idle") {
      void onIdle();
    }
    prevStatusRef.current = status;
  }, [snapshot?.status]);

  return { snapshot, setSnapshot };
}
