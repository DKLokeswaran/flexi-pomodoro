import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { alertSeqStore } from "../utils/alertSeqStore";
import { parseJson } from "../utils/fetchJson";

export async function fetchAlertSeq(): Promise<number> {
  const body = await parseJson<{ alertSeq: number }>(
    await fetch(SESSION_API.alertSeq),
  );
  return body.alertSeq;
}

export async function fetchSession(): Promise<SessionSnapshot> {
  const sinceSeq = alertSeqStore.get();
  const q = sinceSeq > 0 ? `?sinceSeq=${sinceSeq}` : "";
  return parseJson(await fetch(`${SESSION_API.session}${q}`));
}

export async function postAction(
  path: string,
  body?: StartSessionBody | undefined,
): Promise<SessionSnapshot> {
  return parseJson(
    await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
