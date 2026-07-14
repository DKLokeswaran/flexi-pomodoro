import { useEffect, useEffectEvent, useState } from "react";
import type { SessionSnapshot } from "@flexi-pomodoro/shared";
import {
  alertsFromSnapshot,
  connectSessionStream,
  playAlerts,
} from "../api";

export function useSessionStream() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  const onSnapshot = useEffectEvent((next: SessionSnapshot) => {
    setSnapshot(next);
    playAlerts(alertsFromSnapshot(next));
  });

  useEffect(() => {
    return connectSessionStream((next) => onSnapshot(next));
  }, []);

  return { snapshot, setSnapshot };
}
