import type { Knex } from "knex";

/** Materialized completed client-timezone days for analytics (M3.5 / M4). */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("daily_stats", (table) => {
    table.string("clientDate").primary();
    table.string("dayStart").notNullable();
    table.string("dayEnd").notNullable();
    table.integer("workedSec").notNullable();
    table.integer("deliberationSec").notNullable();
    table.integer("restSec").notNullable();
    table.integer("pausedSec").notNullable();
    table.string("finalizedAt").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("daily_stats");
}
