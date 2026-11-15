import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, taskProofs, tasks } from "@/db/schema";
import type { createClient } from "@/lib/supabase/server";

export type Receipt = {
  id: string;
  title: string;
  notes: string | null;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
  completedAt: string | null; // ISO
  proofs: { id: string; type: "image" | "file" | "url" | "note"; href: string | null; text: string; caption: string | null }[];
};

// Completed tasks, newest first, each with its project and proofs (private files get 1-hour signed URLs).
export async function loadReceipts(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Receipt[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      notes: tasks.notes,
      projectId: tasks.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      estimatedMinutes: tasks.estimatedMinutes,
      actualMinutes: tasks.actualMinutes,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "completed")))
    .orderBy(desc(tasks.completedAt));

  const proofRows = await db
    .select({
      id: taskProofs.id,
      taskId: taskProofs.taskId,
      type: taskProofs.type,
      value: taskProofs.storagePathOrUrl,
      caption: taskProofs.caption,
    })
    .from(taskProofs)
    .innerJoin(tasks, eq(tasks.id, taskProofs.taskId))
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "completed")))
    .orderBy(taskProofs.createdAt);

  const stored = proofRows.filter((p) => p.type === "image" || p.type === "file");
  const { data: signed } = await supabase.storage.from("proof-uploads").createSignedUrls(stored.map((p) => p.value), 3600);
  const hrefById = new Map(stored.map((p, i) => [p.id, signed?.[i]?.signedUrl ?? null]));

  return rows.map((t) => ({
    ...t,
    completedAt: t.completedAt?.toISOString() ?? null,
    proofs: proofRows
      .filter((p) => p.taskId === t.id)
      .map((p) => ({
        id: p.id,
        type: p.type,
        href: p.type === "url" ? p.value : hrefById.get(p.id) ?? null,
        text: p.type === "note" || p.type === "url" ? p.value : p.caption ?? "File",
        caption: p.caption,
      })),
  }));
}
