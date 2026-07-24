import { fetchAlertSeq } from "../queries/session.api";
import { alertSeqStore } from "./alertSeqStore";

/** Align client watermark with server high-water (no history replay). */
export async function syncAlertSeq(): Promise<number> {
  const seq = await fetchAlertSeq();
  alertSeqStore.set(seq);
  return seq;
}
