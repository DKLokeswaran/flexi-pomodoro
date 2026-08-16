import { useEffect, useState } from "react";

/** Local wall-clock ticker for rendering remaining/overtime from anchors. */
export function useNow(isTicking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTicking) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [isTicking]);
  return now;
}
