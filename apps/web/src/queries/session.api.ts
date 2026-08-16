import type { SessionSnapshot, StartSessionBody } from "@flexi-pomodoro/shared";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { sinceSeqQueryString } from "../utils/alertSeqStore";
import { parseJson } from "../utils/fetchJson";

/** Server high-water mark for alert delivery. */
export async function fetchAlertSeq(): Promise<number> {
  const body = await parseJson<{ alertSeq: number }>(
    await fetch(SESSION_API.alertSeq),
  );
  return body.alertSeq;
}

/** Current session snapshot, requesting only alerts newer than the local watermark. */
export async function fetchSession(): Promise<SessionSnapshot> {
  return parseJson(
    await fetch(`${SESSION_API.session}${sinceSeqQueryString()}`),
  );
}

/** POST a session action; JSON body is optional (start sends overrides). */
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
