import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer("credits").default(5)
});

export const AgentConfig = pgTable('agentConfig', {
  id: serial('id').primaryKey(),
  agentId: varchar('agentId').notNull().unique(),
  name: varchar('name').notNull(),
  description: text('description'),
  agentImage: text('agentImage'),
  tools: jsonb('tools'),
  composioSessionId: varchar('composioSessionId'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  userEmail: text('userEmail').notNull().references(() => users.email),
})

export const Tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  category: varchar('category', {length : 100}).default('General'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const Routines = pgTable("routines", {
  id: varchar("id").primaryKey(),

  agentId: varchar("agent_id")
    .notNull()
    .references(() => AgentConfig.agentId),

  userEmail: text("user_email")
    .notNull()
    .references(() => users.email),

  name: varchar("name").notNull(),
  goal: text("goal").notNull(),
  instructions: text("instructions").notNull(),
  schedule: jsonb("schedule").notNull(),
  tools: jsonb("tools").notNull(),

  isActive: boolean("is_active").default(true).notNull(),

  nextRunAt: timestamp("next_run_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const RoutineExecutions = pgTable("routine_executions", {
  id: varchar("id").primaryKey(),
  routineId: varchar("routine_id").notNull().references(() => Routines.id),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("routine_executions_routine_scheduled_unique").on(table.routineId, table.scheduledFor),
]);

export const AgentChatHistory = pgTable("agent_chat_history", {
  agentId: varchar("agent_id").primaryKey().references(() => AgentConfig.agentId),
  userEmail: text("user_email").notNull().references(() => users.email),
  messages: jsonb("messages").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
 
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
