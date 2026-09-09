import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AsyncMutex } from "../../utils/asyncMutex.js";

describe("AsyncMutex", () => {
  it("runExclusive serializes overlapping work", async () => {
    const mutex = new AsyncMutex();
    const order: string[] = [];

    const a = mutex.runExclusive(async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 20));
      order.push("a-end");
      return "a";
    });

    const b = mutex.runExclusive(async () => {
      order.push("b-start");
      order.push("b-end");
      return "b";
    });

    assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
    assert.deepEqual(order, ["a-start", "a-end", "b-start", "b-end"]);
  });

  it("tryRunExclusive skips when locked", async () => {
    const mutex = new AsyncMutex();
    let skipped: null | true = null;

    const hold = mutex.runExclusive(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return "held";
    });

    await new Promise((r) => setTimeout(r, 5));
    skipped = (await mutex.tryRunExclusive(() => "ran")) === null ? true : null;
    assert.equal(skipped, true);
    assert.equal(await hold, "held");

    assert.equal(await mutex.tryRunExclusive(() => "ok"), "ok");
  });
});
