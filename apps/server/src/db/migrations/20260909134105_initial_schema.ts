import type { Knex } from "knex";

/**
 * Initial M3 schema: settings singleton, sessions/runtime, class-table phases
 * with per-kind detail tables, and pause_slices (PRD §7.3 / FPMD-19).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("settings", (table) => {
    table.integer("id").primary();
    table.integer("workDurationSec").notNullable();
    table.integer("shortRestDurationSec").notNullable();
    table.integer("cyclesBeforeLongRest").notNullable();
    table.integer("longRestDurationSec").notNullable();
    table.integer("decisionWindowSec").notNullable();
    table.boolean("alertsMuted").notNullable();
    table.string("workPauseStrategy").notNullable();
    table.string("updatedAt").notNullable();
  });

  await knex.schema.createTable("sessions", (table) => {
    table.string("id").primary();
    table.string("startedAt").notNullable();
    table.string("completedAt").nullable();
    table.string("status").notNullable();
    table.string("pauseStrategy").notNullable();
    table.integer("workDurationSec").notNullable();
    table.integer("shortRestDurationSec").notNullable();
    table.integer("cyclesBeforeLongRest").notNullable();
    table.integer("longRestDurationSec").notNullable();
    table.integer("decisionWindowSec").notNullable();
  });

  await knex.schema.createTable("phases", (table) => {
    table.string("id").primary();
    table.string("kind").notNullable();
  });

  await knex.schema.createTable("planned_work", (table) => {
    table
      .string("id")
      .primary()
      .references("id")
      .inTable("phases")
      .onDelete("CASCADE");
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table.integer("plannedDurationSec").notNullable();
    table.string("plannedEndAt").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.integer("pausedSec").notNullable().defaultTo(0);
    table.string("pauseStartedAt").nullable();
    table.string("timerFrozenAt").nullable();
    table.boolean("paused").notNullable().defaultTo(false);
    table.string("endedReason").nullable();
  });

  await knex.schema.createTable("decision", (table) => {
    table
      .string("id")
      .primary()
      .references("id")
      .inTable("phases")
      .onDelete("CASCADE");
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.string("decisionEndsAt").notNullable();
    table.integer("decisionWindowSec").notNullable();
    table.integer("durationSec").nullable();
    table.string("outcome").nullable();
  });

  await knex.schema.createTable("short_rest_ack", (table) => {
    table
      .string("id")
      .primary()
      .references("id")
      .inTable("phases")
      .onDelete("CASCADE");
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.string("decisionEndsAt").notNullable();
    table.integer("decisionWindowSec").notNullable();
    table.integer("durationSec").nullable();
    table.string("outcome").nullable();
  });

  await knex.schema.createTable("extended_work", (table) => {
    table
      .string("id")
      .primary()
      .references("id")
      .inTable("phases")
      .onDelete("CASCADE");
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.integer("actualDurationSec").nullable();
    table.string("endedReason").nullable();
  });

  await knex.schema.createTable("rest", (table) => {
    table
      .string("id")
      .primary()
      .references("id")
      .inTable("phases")
      .onDelete("CASCADE");
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table.integer("plannedDurationSec").notNullable();
    table.string("plannedEndAt").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.integer("actualDurationSec").nullable();
    table.string("endedReason").nullable();
  });

  await knex.schema.createTable("session_runtime", (table) => {
    table
      .string("sessionId")
      .primary()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table
      .string("currentPhaseId")
      .notNullable()
      .references("id")
      .inTable("phases");
    table.integer("workedSec").notNullable().defaultTo(0);
    table.integer("deliberationSec").notNullable().defaultTo(0);
    table.integer("restSec").notNullable().defaultTo(0);
    table.integer("pausedSec").notNullable().defaultTo(0);
    table.integer("alertSeq").notNullable().defaultTo(0);
    table.string("updatedAt").notNullable();
  });

  await knex.schema.createTable("pause_slices", (table) => {
    table.string("id").primary();
    table
      .string("sessionId")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE");
    table.integer("cycleIndex").notNullable();
    table
      .string("plannedWorkPhaseId")
      .notNullable()
      .references("id")
      .inTable("planned_work")
      .onDelete("CASCADE");
    table.string("strategy").notNullable();
    table.string("startedAt").notNullable();
    table.string("endedAt").nullable();
    table.integer("durationSec").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pause_slices");
  await knex.schema.dropTableIfExists("session_runtime");
  await knex.schema.dropTableIfExists("rest");
  await knex.schema.dropTableIfExists("extended_work");
  await knex.schema.dropTableIfExists("short_rest_ack");
  await knex.schema.dropTableIfExists("decision");
  await knex.schema.dropTableIfExists("planned_work");
  await knex.schema.dropTableIfExists("phases");
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.dropTableIfExists("settings");
}
