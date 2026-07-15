import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SessionSnapshot,
  SettingsPatch,
  StartSessionBody,
} from "@flexi-pomodoro/shared";
import {
  alertsFromSnapshot,
  fetchSettings,
  playAlerts,
  postAction,
  saveSettings,
} from "../api";

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
      body?: StartSessionBody;
    }) => postAction(path, body),
    onSuccess: (snap) => {
      onSnapshot(snap);
      playAlerts(alertsFromSnapshot(snap));
    },
  });
}
