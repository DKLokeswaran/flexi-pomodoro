import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionOverrides, SettingsPatch } from "@flexi-pomodoro/shared";
import {
  alertsFromSnapshot,
  fetchSettings,
  playAlerts,
  postAction,
  saveSettings,
} from "../api";
import type { SessionSnapshot } from "@flexi-pomodoro/shared";

export const settingsQueryKey = ["settings"] as const;

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: fetchSettings,
  });
}

export function useSaveSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => saveSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(settingsQueryKey, data);
    },
  });
}

export function useSessionActionMutation(
  onSnapshot: (snap: SessionSnapshot) => void,
) {
  return useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body?: SessionOverrides;
    }) => postAction(path, body),
    onSuccess: (snap) => {
      onSnapshot(snap);
      playAlerts(alertsFromSnapshot(snap));
    },
  });
}
