import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { AlertEvent, SessionSnapshot } from "@flexi-pomodoro/shared";
import {
  installMemoryLocalStorage,
  installRecordingAudio,
} from "../helpers/browserGlobals";

const ALERT_SEQ_KEY = "flexi-pomodoro:lastPlayedAlertSeq";

// Browser globals must exist before the alert modules load their singleton store.
const storage = installMemoryLocalStorage();
const played = installRecordingAudio();
const { alertsFromSnapshot, playAlerts } =
  await import("../../utils/playAlerts");
const { alertSeqStore, sinceSeqQueryString } =
  await import("../../utils/alertSeqStore");

const REST_ACK: AlertEvent = { seq: 2, id: "rest_ack" };
const REST_START: AlertEvent = { seq: 3, id: "short_rest_start" };

describe("playAlerts", () => {
  beforeEach(() => {
    alertSeqStore.set(0);
    played.length = 0;
  });

  it("plays each new alert's own sound in order and stores the watermark", () => {
    playAlerts([REST_ACK, REST_START]);
    assert.deepEqual(played, [
      "/alerts/placeholder-rest_ack.wav",
      "/alerts/placeholder-short_rest_start.wav",
    ]);
    assert.equal(alertSeqStore.get(), 3);
    assert.equal(storage.get(ALERT_SEQ_KEY), "3");
  });

  it("does not replay alerts that arrive again from the stream", () => {
    playAlerts([REST_ACK, REST_START]); // action response
    playAlerts([REST_ACK, REST_START]); // same alerts via SSE
    assert.equal(played.length, 2);
  });

  it("plays only the alerts newer than the watermark", () => {
    playAlerts([REST_ACK]);
    playAlerts([REST_ACK, REST_START]);
    assert.deepEqual(played, [
      "/alerts/placeholder-rest_ack.wav",
      "/alerts/placeholder-short_rest_start.wav",
    ]);
  });

  it("plays a new session's alerts after the watermark is synced back to zero", () => {
    playAlerts([REST_START]);
    alertSeqStore.set(0); // idle sync: server sequence restarted
    playAlerts([{ seq: 1, id: "work_planned_end" }]);
    assert.deepEqual(played, [
      "/alerts/placeholder-short_rest_start.wav",
      "/alerts/placeholder-work_planned_end.wav",
    ]);
    assert.equal(alertSeqStore.get(), 1);
  });
});

describe("alert watermark helpers", () => {
  beforeEach(() => {
    alertSeqStore.set(0);
  });

  it("advance only moves the watermark forward", () => {
    alertSeqStore.advance(5);
    alertSeqStore.advance(3);
    assert.equal(alertSeqStore.get(), 5);
  });

  it("sinceSeqQueryString is empty at zero and carries a positive watermark", () => {
    assert.equal(sinceSeqQueryString(), "");
    alertSeqStore.set(4);
    assert.equal(sinceSeqQueryString(), "?sinceSeq=4");
  });

  it("alertsFromSnapshot reads idle and active snapshots", () => {
    const idle: SessionSnapshot = {
      status: "idle",
      serverNow: "2026-07-12T10:00:00.000Z",
      pendingAlerts: [{ seq: 4, id: "long_rest_end" }],
      alertSeq: 4,
    };
    assert.deepEqual(alertsFromSnapshot(idle), [
      { seq: 4, id: "long_rest_end" },
    ]);

    const active = {
      status: "active",
      serverNow: "2026-07-12T10:00:00.000Z",
      session: { pendingAlerts: [REST_ACK] },
    } as SessionSnapshot;
    assert.deepEqual(alertsFromSnapshot(active), [REST_ACK]);
  });
});
