"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, taskProofs, taskSubtasks, tasks, timeLogs } from "@/db/schema";
import { generateTaskPrep } from "@/lib/ai";
import { isUuid, toClientTask } from "@/lib/dashboard-rows";
import type { OptimisticSubtask, OptimisticTask, TaskSchedule } from "@/lib/optimistic-rules";
import {
  assertCanComplete, assertValidLoggedMinutes, calculateLoggedMinutes, normalizeAiPrepOutput, resolveAiEstimate, type AiPrepParts,
} from "@/lib/task-rules";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertCanDeleteTask } from "@/lib/receipt-rules";
import { nextDeadline, nextWeekdayDeadline } from "@/lib/recurrence";
import { createClient } from "@/lib/supabase/server";

// Drizzle bypasses RLS, so every action below must call requireUser() and filter by user.id.

type Result = { error?: string };

const PROOF_BUCKET = "proof-uploads";
const AI_PREP_COOLDOWN_MS = 15_000;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // verifies the JWT locally (no Auth server round trip) when the project uses asymmetric signing keys
  const user = data?.claims ? { id: data.claims.sub, email: data.claims.email } : null;
  return { supabase, user };
}

async function findOwnedTask(userId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  return task;
}

export async function createTask(input: {
  id?: string; // client-chosen so the card can appear before this returns
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes?: number;
  notes?: string;
  projectId?: string | null;
}): Promise<Result & { task?: OptimisticTask }> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { error: "Give the task a title." };
  if (input.completionType !== "tick" && input.completionType !== "proof") return { error: "Invalid task type." };
  if (input.id && !isUuid(input.id)) return { error: "Invalid id." };
  const minutes = input.estimatedMinutes;
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes <= 0)) {
    return { error: "Estimated minutes must be a whole number above 0." };
  }

  if (input.projectId) {
    const [owned] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, user.id)));
    if (!owned) return { error: "Project not found." };
  }

  const [row] = await db
    .insert(tasks)
    .values({
      id: input.id,
      projectId: input.projectId ?? null,
      userId: user.id,
      title,
      completionType: input.completionType,
      estimatedMinutes: minutes,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return { task: toClientTask(row) };
}

// FormData because images are sent as files. Fields: taskId, type ("image" | "text"), file | text, caption?
// Returns a signed thumbnail URL for image proofs so the card can show it without a re-render.
export async function addTaskProof(formData: FormData): Promise<Result & { thumbnail?: { id: string; url: string } }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId"));
  if (!(await findOwnedTask(user.id, taskId))) return { error: "Task not found." };
  const caption = String(formData.get("caption") ?? "").trim() || null;

  if (formData.get("type") === "image") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
    if (!file.type.startsWith("image/")) return { error: "That file is not an image." };

    const extension = file.type.split("/")[1].replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${user.id}/${taskId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type });
    if (error) return { error: `Upload failed: ${error.message}` };

    const [proof] = await db
      .insert(taskProofs)
      .values({ taskId, type: "image", storagePathOrUrl: path, caption })
      .returning({ id: taskProofs.id });
    const { data: signed } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
    return { thumbnail: signed ? { id: proof.id, url: signed.signedUrl } : undefined };
  } else {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return { error: "Type a note or paste a link first." };
    const type = /^https?:\/\//i.test(text) ? "url" : "note";
    await db.insert(taskProofs).values({ taskId, type, storagePathOrUrl: text, caption });
  }

  return {};
}

// Returns the next copy when the task repeats, so the client can show it without a reload.
export async function completeTask(taskId: string): Promise<Result & { nextTask?: OptimisticTask }> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const task = await findOwnedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  const proofs = await db.select({ id: taskProofs.id }).from(taskProofs).where(eq(taskProofs.taskId, taskId));
  try {
    assertCanComplete(task, proofs);
  } catch (e) {
    return { error: (e as Error).message };
  }

  await db
    .update(tasks)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

  const base = task.deadline ?? new Date();
  const next = task.repeatWeekdays?.length
    ? nextWeekdayDeadline(base, task.repeatWeekdays, task.repeatUntil)
    : task.repeatEvery && task.repeatUnit
      ? nextDeadline(base, task.repeatEvery, task.repeatUnit, task.repeatUntil)
      : null;
  if (!next) return {};
  const [row] = await db
    .insert(tasks)
    .values({
      userId: user.id,
      projectId: task.projectId,
      title: task.title,
      notes: task.notes,
      completionType: task.completionType,
      estimatedMinutes: task.estimatedMinutes,
      deadline: next,
      repeatEvery: task.repeatEvery,
      repeatWeekdays: task.repeatWeekdays,
      repeatUnit: task.repeatUnit,
      repeatUntil: task.repeatUntil,
    })
    .returning();
  return { nextTask: toClientTask(row) };
}

export async function startTaskTimer(taskId: string): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const task = await findOwnedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };
  if (task.activeTimerStartedAt) return { error: "Timer is already running." };

  await db.update(tasks).set({ activeTimerStartedAt: new Date() }).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
  return {};
}

export async function stopTaskTimer(taskId: string, trimmedIdleMinutes: number, addedMinutes = 0): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!Number.isFinite(trimmedIdleMinutes) || trimmedIdleMinutes < 0 || !Number.isInteger(trimmedIdleMinutes)) {
    return { error: "Idle minutes must be a whole number, 0 or more." };
  }
  if (!Number.isInteger(addedMinutes) || addedMinutes < 0) return { error: "Added minutes must be a whole number, 0 or more." };

  const task = await findOwnedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };
  const startedAt = task.activeTimerStartedAt;
  if (!startedAt) return { error: "Timer is not running." };

  const endedAt = new Date();
  const durationMinutes = calculateLoggedMinutes({ startedAt, endedAt, trimmedIdleMinutes, addedMinutes });

  await db.transaction(async (tx) => {
    await tx.insert(timeLogs).values({ taskId, startedAt, endedAt, durationMinutes });
    await tx
      .update(tasks)
      .set({ actualMinutes: sql`${tasks.actualMinutes} + ${durationMinutes}`, activeTimerStartedAt: null })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
  });
  return {};
}

// For work done without the timer (offline, away from the phone): "it took me 40 minutes".
export async function logTaskMinutes(taskId: string, minutes: number): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  try {
    assertValidLoggedMinutes(minutes);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!(await findOwnedTask(user.id, taskId))) return { error: "Task not found." };

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - minutes * 60_000);
  await db.transaction(async (tx) => {
    await tx.insert(timeLogs).values({ taskId, startedAt, endedAt, durationMinutes: minutes });
    await tx
      .update(tasks)
      .set({ actualMinutes: sql`${tasks.actualMinutes} + ${minutes}` })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
  });
  return {};
}

export async function scheduleTask(taskId: string, scheduledStart: Date): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!(scheduledStart instanceof Date) || Number.isNaN(scheduledStart.getTime())) return { error: "Invalid time." };

  // status <> completed: a finished task must never slide back onto the calendar.
  const updated = await db
    .update(tasks)
    .set({ scheduledStart, status: "scheduled" })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id), ne(tasks.status, "completed")))
    .returning({ id: tasks.id });
  if (updated.length === 0) return { error: "Task not found." };
  return {};
}

export async function unscheduleTask(taskId: string): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const updated = await db
    .update(tasks)
    .set({ scheduledStart: null, status: "todo" })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id), ne(tasks.status, "completed")))
    .returning({ id: tasks.id });
  if (updated.length === 0) return { error: "Task not found." };
  return {};
}

export async function deleteTask(taskId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  const task = await findOwnedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };
  try {
    assertCanDeleteTask(task.status);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const images = await db
    .select({ path: taskProofs.storagePathOrUrl })
    .from(taskProofs)
    .where(and(eq(taskProofs.taskId, taskId), eq(taskProofs.type, "image")));

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id))); // proofs cascade
  if (images.length) await supabase.storage.from(PROOF_BUCKET).remove(images.map((i) => i.path));
  return {};
}

export async function updateTaskEstimate(taskId: string, estimatedMinutes: number | null): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes <= 0)) {
    return { error: "Estimated minutes must be a whole number above 0." };
  }

  const updated = await db
    .update(tasks)
    .set({ estimatedMinutes })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });
  if (updated.length === 0) return { error: "Task not found." };
  return {};
}

export async function updateTaskSchedule(taskId: string, s: TaskSchedule): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  const date = (v: string | null) => (v ? new Date(v) : null);
  const [deadline, repeatUntil] = [date(s.deadline), date(s.repeatUntil)];
  if ([deadline, repeatUntil].some((d) => d && Number.isNaN(d.getTime()))) return { error: "Invalid date." };
  if (s.repeatEvery !== null && !s.repeatWeekdays?.length && (!Number.isInteger(s.repeatEvery) || s.repeatEvery < 1 || !s.repeatUnit)) {
    return { error: "Repeat needs a whole number above 0 and a unit." };
  }
  const weekdays = s.repeatWeekdays?.length ? s.repeatWeekdays : null;
  if (weekdays && !weekdays.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) return { error: "Invalid weekday." };
  const repeating = s.repeatEvery !== null || weekdays !== null;

  const updated = await db
    .update(tasks)
    .set({
      deadline,
      repeatEvery: weekdays ? null : s.repeatEvery,
      repeatWeekdays: weekdays,
      repeatUnit: repeating && !weekdays ? s.repeatUnit : null,
      repeatUntil: repeating ? repeatUntil : null,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });
  if (updated.length === 0) return { error: "Task not found." };
  return {};
}

// Runs only when the user clicks AI Prep; never call this from task creation.
export async function runAiTaskPrep(taskId: string, parts: AiPrepParts): Promise<Result & {
  prep?: { estimatedMinutes: number | null; questions: string[] | null; pitfalls: OptimisticSubtask[] };
}> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!parts.estimate && !parts.questions && !parts.pitfalls) return { error: "Pick at least one thing for AI to provide." };

  const task = await findOwnedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  // Cooldown: each run is a paid API call.
  const limit = checkRateLimit(`ai-prep:${user.id}`, { max: 1, windowMs: AI_PREP_COOLDOWN_MS });
  if (!limit.ok) return { error: `AI Prep is cooling down. Try again in ${limit.retryAfterSeconds}s.` };

  let prep;
  try {
    prep = normalizeAiPrepOutput(await generateTaskPrep(task, parts), parts);
  } catch (e) {
    return { error: `AI Prep failed: ${(e as Error).message}` };
  }

  await db.transaction(async (tx) => {
    // Only touch what was requested; a pitfalls-only run must not change the estimate or questions.
    const changes: Partial<typeof tasks.$inferInsert> = {};
    if (prep.estimatedMinutes !== null) changes.estimatedMinutes = resolveAiEstimate(task.estimatedMinutes, prep.estimatedMinutes);
    if (parts.questions) changes.aiClarifyingQuestions = prep.clarifyingQuestions;
    if (Object.keys(changes).length > 0) {
      await tx.update(tasks).set(changes).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
    }
    if (parts.pitfalls) {
      // A second run replaces unchecked pitfalls instead of duplicating them.
      await tx.delete(taskSubtasks).where(and(eq(taskSubtasks.taskId, taskId), eq(taskSubtasks.source, "ai_pitfall"), eq(taskSubtasks.isCompleted, false)));
      await tx.insert(taskSubtasks).values(prep.pitfalls.map((label) => ({ taskId, label, source: "ai_pitfall" as const })));
    }
  });

  // Every pitfall now on the task (checked ones are kept), so the client can swap its pitfall list wholesale.
  const pitfalls = await db
    .select({ id: taskSubtasks.id, label: taskSubtasks.label, isCompleted: taskSubtasks.isCompleted, source: taskSubtasks.source })
    .from(taskSubtasks)
    .where(and(eq(taskSubtasks.taskId, taskId), eq(taskSubtasks.source, "ai_pitfall")));
  return {
    prep: {
      estimatedMinutes: prep.estimatedMinutes === null ? null : resolveAiEstimate(task.estimatedMinutes, prep.estimatedMinutes),
      questions: parts.questions ? prep.clarifyingQuestions : null,
      pitfalls,
    },
  };
}

export async function addSubtask(taskId: string, label: string, id?: string): Promise<Result & { subtask?: OptimisticSubtask }> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  const trimmed = label.trim();
  if (!trimmed) return { error: "Type a subtask first." };
  if (id && !isUuid(id)) return { error: "Invalid id." };
  if (!(await findOwnedTask(user.id, taskId))) return { error: "Task not found." };

  const [subtask] = await db
    .insert(taskSubtasks)
    .values({ id, taskId, label: trimmed, source: "user" })
    .returning({ id: taskSubtasks.id, label: taskSubtasks.label, isCompleted: taskSubtasks.isCompleted, source: taskSubtasks.source });
  return { subtask };
}

export async function toggleSubtask(subtaskId: string): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  // Ownership comes from the parent task, so confirm it before flipping the flag.
  const [owned] = await db
    .select({ id: taskSubtasks.id })
    .from(taskSubtasks)
    .innerJoin(tasks, eq(tasks.id, taskSubtasks.taskId))
    .where(and(eq(taskSubtasks.id, subtaskId), eq(tasks.userId, user.id)));
  if (!owned) return { error: "Subtask not found." };

  await db.update(taskSubtasks).set({ isCompleted: sql`not ${taskSubtasks.isCompleted}` }).where(eq(taskSubtasks.id, subtaskId));
  return {};
}
