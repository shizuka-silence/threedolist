"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, triageItems } from "@/db/schema";
import { parseEmailBatchToTriageItems } from "@/lib/ai";
import { isUuid, toClientTask } from "@/lib/dashboard-rows";
import type { OptimisticTask, OptimisticTriageItem } from "@/lib/optimistic-rules";
import { createClient } from "@/lib/supabase/server";
import { buildPromotionTaskPayload, formatEmailBatchForAi, normalizeParsedTriageItems, parseTriageCategory, type NormalizedTriageItem } from "@/lib/triage-rules";

// Drizzle bypasses RLS, so every action below must check getUser() and filter by user.id.

type Result = { error?: string };

// The columns the dashboard keeps for a pending triage item (same shape as OptimisticTriageItem).
const triageClientColumns = {
  id: triageItems.id,
  category: triageItems.category,
  sourceSubject: triageItems.sourceSubject,
  summary: triageItems.summary,
  suggestedAction: triageItems.suggestedAction,
};

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // verifies the JWT locally (no Auth server round trip) when the project uses asymmetric signing keys
  const user = data?.claims ? { id: data.claims.sub, email: data.claims.email } : null;
  return user;
}

export async function dumpToTriage(input: {
  id?: string;
  sourceSubject: string;
  summary?: string;
  suggestedAction?: string;
}): Promise<Result & { item?: OptimisticTriageItem }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  const sourceSubject = input.sourceSubject.trim();
  if (!sourceSubject) return { error: "Type something to dump." };
  if (input.id && !isUuid(input.id)) return { error: "Invalid id." };

  const [item] = await db
    .insert(triageItems)
    .values({
      id: input.id,
      userId: user.id,
      sourceSubject,
      summary: input.summary?.trim() || null,
      suggestedAction: input.suggestedAction?.trim() || null,
      status: "pending",
    })
    .returning(triageClientColumns);
  return { item };
}

// Task defaults come from the item's category (buildPromotionTaskPayload); the caller may override title / type.
export async function promoteTriageItem(
  itemId: string,
  overrides: { title?: string; completionType?: "tick" | "proof"; taskId?: string } = {},
): Promise<Result & { task?: OptimisticTask }> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (overrides.taskId && !isUuid(overrides.taskId)) return { error: "Invalid id." };
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
    if (!claimed) return null;
    const [created] = await tx
      .insert(tasks)
      .values({
        id: overrides.taskId,
        userId: user.id,
        title,
        completionType: overrides.completionType ?? defaults.completionType,
        notes: defaults.notes || null,
      })
      .returning();
    return created;
  });
  if (!promoted) return { error: "Triage item not found." };

  return { task: toClientTask(promoted) };
}

// Paste raw email text; one AI call sorts it into categorized items.
export async function ingestEmailDump(rawText: string): Promise<Result & { items?: OptimisticTriageItem[] }> {
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

  const inserted = await db
    .insert(triageItems)
    .values(items.map((item) => ({ ...item, userId: user.id })))
    .returning(triageClientColumns);
  return { items: inserted };
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
  return {};
}

export async function updateTriageItemCategory(triageItemId: string, category: string): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in." };

  let parsed;
  try {
    parsed = parseTriageCategory(category);
  } catch {
    return { error: "Invalid category." };
  }

  const updated = await db
    .update(triageItems)
    .set({ category: parsed })
    .where(and(eq(triageItems.id, triageItemId), eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
    .returning({ id: triageItems.id });
  if (updated.length === 0) return { error: "Triage item not found." };

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

  return {};
}
