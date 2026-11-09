import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@flexi-pomodoro/shared";
import { saveSettings } from "../queries/settings.api";
import { settingsQueryKey } from "../queries/useSessionApi";
import { seedTimezoneIfNeeded } from "../utils/seedTimezone";

/** After the first settings fetch, seed browser IANA timezone once. */
export function useSeedTimezone(settings: Settings | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!settings) return;

    void seedTimezoneIfNeeded(settings, saveSettings)
      .then((next) => {
        if (next) queryClient.setQueryData(settingsQueryKey, next);
      })
      .catch(() => {
        // Leave the gate unset so a later visit can retry.
      });
  }, [settings, queryClient]);
}
