"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tasks, triageItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// Drizzle bypasses RLS, so every action below must check getUser() and filter by user.id.

type Result = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function dumpToTriage(input: {
  sourceSubject: string;
  summary?: string;
  suggestedAction?: string;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  const sourceSubject = input.sourceSubject.trim();
  if (!sourceSubject) return { error: "Type something to dump." };

  await db.insert(triageItems).values({
    userId: user.id,
    sourceSubject,
    summary: input.summary?.trim() || null,
    suggestedAction: input.suggestedAction?.trim() || null,
    status: "pending",
  });
  revalidatePath("/");
  return {};
}

export async function promoteTriageItem(
  itemId: string,
  input: { title: string; completionType: "tick" | "proof"; estimatedMinutes?: number; notes?: string },
): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { error: "Give the task a title." };
  if (input.completionType !== "tick" && input.completionType !== "proof") return { error: "Invalid task type." };
  const minutes = input.estimatedMinutes;
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes <= 0)) {
    return { error: "Estimated minutes must be a whole number above 0." };
  }

  const promoted = await db.transaction(async (tx) => {
    // Only a pending item can be promoted, so a double-click can't create two tasks.
    const [item] = await tx
      .update(triageItems)
      .set({ status: "promoted" })
      .where(and(eq(triageItems.id, itemId), eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
      .returning({ id: triageItems.id });
    if (!item) return false;
    await tx.insert(tasks).values({
      userId: user.id,
      title,
      completionType: input.completionType,
      estimatedMinutes: minutes,
      notes: input.notes?.trim() || null,
    });
    return true;
  });
  if (!promoted) return { error: "Triage item not found." };

  revalidatePath("/");
  return {};
}

export async function dismissTriageItem(itemId: string): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  const dismissed = await db
    .update(triageItems)
    .set({ status: "dismissed" })
    .where(and(eq(triageItems.id, itemId), eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
    .returning({ id: triageItems.id });
  if (dismissed.length === 0) return { error: "Triage item not found." };

  revalidatePath("/");
  return {};
}
