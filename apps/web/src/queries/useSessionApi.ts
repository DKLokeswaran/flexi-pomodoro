import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SessionSnapshot,
  SettingsPatch,
  StartSessionBody,
} from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { fetchSettings, saveSettings } from "./settings.api";
import { postAction } from "./session.api";
import { alertsFromSnapshot, playAlerts } from "../utils/playAlerts";
import { REQUEST_FAILED } from "../constants/labels";
import { useToast } from "../providers/ToastProvider";

export const settingsQueryKey = ["settings"] as const;

const ACTION_SUCCESS: Record<string, string> = {
  [SESSION_API.start]: "Session started",
  [SESSION_API.ackRest]: "Rest started",
  [SESSION_API.continue]: "Extended work started",
  [SESSION_API.startRest]: "Rest started",
  [SESSION_API.softPause]: "Soft pause on",
  [SESSION_API.softResume]: "Soft pause off",
  [SESSION_API.endLongRest]: "Session complete",
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: fetchSettings,
  });
}

export function useSaveSettingsMutation() {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => saveSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(settingsQueryKey, data);
      pushToast({ kind: "success", message: "Defaults saved" });
    },
    onError: (err) => {
      pushToast({
        kind: "error",
        message: errorMessage(err, "Save failed"),
      });
    },
  });
}

export function useSessionActionMutation(
  onSnapshot: (snap: SessionSnapshot) => void,
) {
  const { pushToast } = useToast();
  return useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body?: StartSessionBody;
    }) => postAction(path, body),
    onSuccess: (snap, variables) => {
      onSnapshot(snap);
      playAlerts(alertsFromSnapshot(snap));
      const message = ACTION_SUCCESS[variables.path];
      if (message) {
        pushToast({ kind: "success", message });
      }
    },
    onError: (err) => {
      pushToast({
        kind: "error",
        message: errorMessage(err, REQUEST_FAILED),
      });
    },
  });
}
