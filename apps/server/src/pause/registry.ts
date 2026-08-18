import { hardPauseStrategy } from "./hardPause.js";
import { softPauseStrategy } from "./softPause.js";
import type { WorkPauseStrategy, WorkPauseStrategyId } from "./types.js";

/** Lookup table of pause plugins; inject a subset to prove delete-ability. */
export class PauseStrategyRegistry {
  private readonly byId: ReadonlyMap<WorkPauseStrategyId, WorkPauseStrategy>;

  constructor(strategies: readonly WorkPauseStrategy[]) {
    this.byId = new Map(strategies.map((strategy) => [strategy.id, strategy]));
  }

  /** Return the plugin for `id`, or undefined if it was not registered. */
  get(id: WorkPauseStrategyId): WorkPauseStrategy | undefined {
    return this.byId.get(id);
  }
}

/** Production registry: soft (default) and hard (experimental). */
export function defaultPauseRegistry(): PauseStrategyRegistry {
  return new PauseStrategyRegistry([softPauseStrategy, hardPauseStrategy]);
}
