import type { Knex } from "knex";

/** Add settings.timezone for analytics local-day bounds (M3.5 / FR-AN-9). */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("settings", (table) => {
    table.string("timezone").notNullable().defaultTo("UTC");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("settings", (table) => {
    table.dropColumn("timezone");
  });
}
