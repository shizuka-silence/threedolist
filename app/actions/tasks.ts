"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { taskProofs, tasks } from "@/db/schema";
import { assertCanComplete } from "@/lib/task-rules";
import { createClient } from "@/lib/supabase/server";

// Drizzle bypasses RLS, so every action below must call requireUser() and filter by user.id.

type Result = { error?: string };

const PROOF_BUCKET = "proof-uploads";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function findOwnedTask(userId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  return task;
}

export async function createTask(input: {
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes?: number;
  notes?: string;
}): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { error: "Give the task a title." };
  if (input.completionType !== "tick" && input.completionType !== "proof") return { error: "Invalid task type." };
  const minutes = input.estimatedMinutes;
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes <= 0)) {
    return { error: "Estimated minutes must be a whole number above 0." };
  }

  await db.insert(tasks).values({
    userId: user.id,
    title,
    completionType: input.completionType,
    estimatedMinutes: minutes,
    notes: input.notes?.trim() || null,
  });
  revalidatePath("/");
  return {};
}

// FormData because images are sent as files. Fields: taskId, type ("image" | "text"), file | text, caption?
export async function addTaskProof(formData: FormData): Promise<Result> {
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

    await db.insert(taskProofs).values({ taskId, type: "image", storagePathOrUrl: path, caption });
  } else {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return { error: "Type a note or paste a link first." };
    const type = /^https?:\/\//i.test(text) ? "url" : "note";
    await db.insert(taskProofs).values({ taskId, type, storagePathOrUrl: text, caption });
  }

  revalidatePath("/");
  return {};
}

export async function completeTask(taskId: string): Promise<Result> {
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
  revalidatePath("/");
  return {};
}

export async function deleteTask(taskId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!(await findOwnedTask(user.id, taskId))) return { error: "Task not found." };

  const images = await db
    .select({ path: taskProofs.storagePathOrUrl })
    .from(taskProofs)
    .where(and(eq(taskProofs.taskId, taskId), eq(taskProofs.type, "image")));

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id))); // proofs cascade
  if (images.length) await supabase.storage.from(PROOF_BUCKET).remove(images.map((i) => i.path));
  revalidatePath("/");
  return {};
}
