"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tasks, triageItems } from "@/db/schema";
import { parseEmailBatchToTriageItems } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { buildPromotionTaskPayload, formatEmailBatchForAi, normalizeParsedTriageItems, type NormalizedTriageItem } from "@/lib/triage-rules";

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

// Task defaults come from the item's category (buildPromotionTaskPayload); the caller may override title / type.
export async function promoteTriageItem(
  itemId: string,
  overrides: { title?: string; completionType?: "tick" | "proof" } = {},
): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (overrides.completionType && overrides.completionType !== "tick" && overrides.completionType !== "proof") {
    return { error: "Invalid task type." };
  }

  const [item] = await db
    .select()
    .from(triageItems)
    .where(and(eq(triageItems.id, itemId), eq(triageItems.userId, user.id), eq(triageItems.status, "pending")));
  if (!item) return { error: "Triage item not found." };

  const defaults = buildPromotionTaskPayload(item);
  const title = overrides.title?.trim() || defaults.title;

  const promoted = await db.transaction(async (tx) => {
    // Only a pending item can be promoted, so a double-click can't create two tasks.
    const [claimed] = await tx
      .update(triageItems)
      .set({ status: "promoted" })
      .where(and(eq(triageItems.id, itemId), eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
      .returning({ id: triageItems.id });
    if (!claimed) return false;
    await tx.insert(tasks).values({
      userId: user.id,
      title,
      completionType: overrides.completionType ?? defaults.completionType,
      notes: defaults.notes || null,
    });
    return true;
  });
  if (!promoted) return { error: "Triage item not found." };

  revalidatePath("/");
  return {};
}

// Paste raw email text; one AI call sorts it into categorized items.
export async function ingestEmailDump(rawText: string): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!rawText.trim()) return { error: "Paste some email text first." };

  let items: NormalizedTriageItem[];
  try {
    const parsed = await parseEmailBatchToTriageItems(formatEmailBatchForAi([{ body: rawText }]));
    items = normalizeParsedTriageItems(parsed.items);
  } catch (error) {
    console.error("Email dump AI failed", error);
    return { error: "AI sorting failed. Try again, or use the brain dump box." };
  }
  if (items.length === 0) return { error: "No items found in that text." };

  await db.insert(triageItems).values(items.map((item) => ({ ...item, userId: user.id })));
  revalidatePath("/");
  return {};
}

// Optional: pokes the Apps Script web app, which then POSTs its emails to /api/triage.
export async function triggerGmailSync(): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };
  const url = process.env.GMAIL_SYNC_WEBHOOK_URL;
  if (!url) return { error: "GMAIL_SYNC_WEBHOOK_URL is not set." };

  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.TRIAGE_WEBHOOK_SECRET}` } });
    if (!res.ok) return { error: `Gmail sync failed (${res.status}).` };
  } catch {
    return { error: "Could not reach the Gmail sync URL." };
  }
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
