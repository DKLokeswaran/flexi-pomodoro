import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import { connectSessionStream } from "./sessionStream.sse";
import { syncAlertSeq } from "../utils/alertSeq";
import { alertsFromSnapshot, playAlerts } from "../utils/playAlerts";

export function useSessionStream() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const prevStatusRef = useRef<SessionSnapshot["status"] | null>(null);

  const onSnapshot = useEffectEvent((next: SessionSnapshot) => {
    setSnapshot(next);
    playAlerts(alertsFromSnapshot(next));
  });

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
