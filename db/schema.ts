import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // Supabase auth.users.id
  name: text("name").notNull(),
  color: text("color").notNull(),
  position: integer("position").notNull().default(0), // folder order in the strip; ties fall back to createdAt
  createdAt: createdAt(),
});

export const projectFiles = pgTable("project_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: createdAt(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // Supabase auth.users.id; RLS key for standalone tasks
  createdAt: createdAt(),
  // Deleting a folder must not delete finished work (receipt log is non-destructive).
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  notes: text("notes"),
  completionType: text("completion_type", { enum: ["proof", "tick"] }).notNull().default("proof"),
  status: text("status", { enum: ["todo", "scheduled", "completed"] }).notNull().default("todo"),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  scheduledStart: ts("scheduled_start"),
  activeTimerStartedAt: ts("active_timer_started_at"),
  aiClarifyingQuestions: jsonb("ai_clarifying_questions").$type<string[]>(),
  completedAt: ts("completed_at"),
  deadline: ts("deadline"),
  // Completing a repeating task spawns the next copy (see completeTask).
  repeatEvery: integer("repeat_every"),
  repeatWeekdays: integer("repeat_weekdays").array(), // 0=Sun..6=Sat; takes priority over every/unit
  repeatUnit: text("repeat_unit", { enum: ["day", "week", "month"] }),
  repeatUntil: ts("repeat_until"),
});

export const taskSubtasks = pgTable("task_subtasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  source: text("source", { enum: ["user", "ai_pitfall"] }).notNull().default("user"),
});

export const taskProofs = pgTable("task_proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["image", "file", "url", "note"] }).notNull(),
  storagePathOrUrl: text("storage_path_or_url").notNull(),
  caption: text("caption"),
  createdAt: createdAt(),
});

export const timeLogs = pgTable("time_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  startedAt: ts("started_at").notNull(),
  endedAt: ts("ended_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
});

export const triageItems = pgTable("triage_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // Supabase auth.users.id; RLS key
  sourceSubject: text("source_subject").notNull(),
  summary: text("summary"),
  suggestedAction: text("suggested_action"),
  sourceUrl: text("source_url"), // link back to the original email, when the sender supplied one
  category: text("category", { enum: ["announcement", "requirement", "opportunity", "reply"] }).notNull().default("requirement"),
  status: text("status", { enum: ["pending", "promoted", "dismissed"] }).notNull().default("pending"),
  createdAt: createdAt(),
});
