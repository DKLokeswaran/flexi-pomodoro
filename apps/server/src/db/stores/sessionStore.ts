import type { Knex } from "knex";

/**
 * Session + runtime persistence (write-through / hydrate in later M3 groups).
 * Constructed in Group 2 so buildApp owns one Knex-backed store set.
 */
export class SessionStore {
  constructor(private readonly _db: Knex) {}
}
