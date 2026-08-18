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
import { errorMessage } from "../utils/errorMessage";
import { useToast } from "../providers/ToastProvider";

export const settingsQueryKey = ["settings"] as const;

const ACTION_SUCCESS: Record<string, string> = {
  [SESSION_API.start]: "Session started",
  [SESSION_API.ackRest]: "Rest started",
  [SESSION_API.continue]: "Extended work started",
  [SESSION_API.startRest]: "Rest started",
  [SESSION_API.endLongRest]: "Session complete",
};

/** Toast copy for a completed timer action. */
function actionSuccessMessage(
  path: string,
  snapshot: SessionSnapshot,
): string | undefined {
  if (path === SESSION_API.pause || path === SESSION_API.resume) {
    const strategy =
      snapshot.status === "active" ? snapshot.session.pauseStrategy : "soft";
    const kind = strategy === "hard" ? "Hard pause" : "Soft pause";
    return path === SESSION_API.pause ? `${kind} on` : `${kind} off`;
  }
  return ACTION_SUCCESS[path];
}

/** Load persisted settings (used as start-form defaults). */
export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: fetchSettings,
  });
}

/** PUT settings and keep the query cache + success/error toasts in sync. */
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => saveSettings(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQueryKey, data);
      pushToast({ kind: "success", message: "Defaults saved" });
    },
    onError: (error) => {
      pushToast({
        kind: "error",
        message: errorMessage(error, "Save failed"),
      });
    },
  });
}

/** POST a timer action, apply the returned snapshot, play alerts, toast. */
export function useSessionActionMutation(
  onSnapshot: (snapshot: SessionSnapshot) => void,
) {
  const { pushToast } = useToast();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: StartSessionBody }) =>
      postAction(path, body),
    onSuccess: (snapshot, variables) => {
      onSnapshot(snapshot);
      playAlerts(alertsFromSnapshot(snapshot));
      const message = actionSuccessMessage(variables.path, snapshot);
      if (message) {
        pushToast({ kind: "success", message });
      }
    },
    onError: (error) => {
      pushToast({
        kind: "error",
        message: errorMessage(error, REQUEST_FAILED),
      });
    },
  });
}
