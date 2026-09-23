import type { Knex } from "knex";

/**
 * Phase / segment persistence (write-through in later M3 groups).
 * Constructed in Group 2 so buildApp owns one Knex-backed store set.
 */
export class PhasesStore {
  constructor(private readonly _db: Knex) {}
}
