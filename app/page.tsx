import { and, desc, eq, sql } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { DashboardProvider } from "@/components/dashboard-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { projectFiles, projects, taskProofs, taskSubtasks, tasks, triageItems } from "@/db/schema";
import { loadReceipts } from "@/app/receipts";
import { toClientProjectFile, toClientTask, toClientTriageItem } from "@/lib/dashboard-rows";
import type { OptimisticState } from "@/lib/optimistic-rules";
import { isProjectLink } from "@/lib/project-rules";
import { createClient } from "@/lib/supabase/server";

export default function Home({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string }> }) {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Loading…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string }> }) {
  const { tab, project: projectParam } = await searchParams;
  await connection(); // per-user page: render at request time (auth/session code reads Date.now())
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // verifies the JWT locally (no Auth server round trip) when the project uses asymmetric signing keys
  const user = data?.claims ? { id: data.claims.sub, email: data.claims.email } : null;
  if (!user) redirect("/login");

  // Table names written out on purpose: in a single-table select Drizzle drops the "tasks." prefix from
  // ${tasks.id}, which would make this subquery compare task_proofs.task_id to its own id.
  const proofCount = sql<number>`(select count(*)::int from task_proofs where task_proofs.task_id = tasks.id)`;

  // None of these queries needs another's result, so they run together instead of one after another.
  const [rows, imageProofs, subtaskRows, pendingTriage, projectRows, fileRows, receipts] = await Promise.all([
    db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        completionType: tasks.completionType,
        estimatedMinutes: tasks.estimatedMinutes,
        actualMinutes: tasks.actualMinutes,
        activeTimerStartedAt: tasks.activeTimerStartedAt,
        status: tasks.status,
        scheduledStart: tasks.scheduledStart,
        aiClarifyingQuestions: tasks.aiClarifyingQuestions,
        deadline: tasks.deadline,
        repeatEvery: tasks.repeatEvery,
        repeatWeekdays: tasks.repeatWeekdays,
        repeatUnit: tasks.repeatUnit,
        repeatUntil: tasks.repeatUntil,
        proofCount,
      })
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(tasks.position, desc(tasks.createdAt)),
    db
      .select({ id: taskProofs.id, taskId: taskProofs.taskId, path: taskProofs.storagePathOrUrl })
      .from(taskProofs)
      .innerJoin(tasks, eq(tasks.id, taskProofs.taskId))
      .where(and(eq(tasks.userId, user.id), eq(taskProofs.type, "image"))),
    db
      .select({
        id: taskSubtasks.id,
        taskId: taskSubtasks.taskId,
        label: taskSubtasks.label,
        isCompleted: taskSubtasks.isCompleted,
        source: taskSubtasks.source,
      })
      .from(taskSubtasks)
      .innerJoin(tasks, eq(tasks.id, taskSubtasks.taskId))
      .where(eq(tasks.userId, user.id)),
    db
      .select({
        id: triageItems.id,
        sourceSubject: triageItems.sourceSubject,
        summary: triageItems.summary,
        suggestedAction: triageItems.suggestedAction,
        sourceUrl: triageItems.sourceUrl,
        deadline: triageItems.deadline,
        sourceBody: triageItems.sourceBody,
        category: triageItems.category,
      })
      .from(triageItems)
      .where(and(eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
      .orderBy(desc(triageItems.createdAt)),
    db
      .select({ id: projects.id, name: projects.name, color: projects.color })
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(projects.position, projects.createdAt),
    db
      .select({ id: projectFiles.id, projectId: projectFiles.projectId, fileName: projectFiles.fileName, fileUrl: projectFiles.fileUrl })
      .from(projectFiles)
      .innerJoin(projects, eq(projects.id, projectFiles.projectId))
      .where(eq(projects.userId, user.id))
      .orderBy(projectFiles.createdAt),
    loadReceipts(supabase, user.id), // loaded up front so the Receipts tab opens instantly
  ]);

  // Private bucket: one batched call signs image proofs and uploaded project files for 1 hour.
  // Skipped entirely when there is nothing to sign.
  const storedFiles = fileRows.filter((f) => !isProjectLink(f.fileUrl));
  const paths = [...imageProofs.map((p) => p.path), ...storedFiles.map((f) => f.fileUrl)];
  const { data: signed } = paths.length
    ? await supabase.storage.from("proof-uploads").createSignedUrls(paths, 3600)
    : { data: null };

  const thumbnailsByTask = new Map<string, { id: string; url: string }[]>();
  imageProofs.forEach((p, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) thumbnailsByTask.set(p.taskId, [...(thumbnailsByTask.get(p.taskId) ?? []), { id: p.id, url }]);
  });
  const signedFileUrl = new Map(storedFiles.map((f, i) => [f.fileUrl, signed?.[imageProofs.length + i]?.signedUrl ?? null]));

  const initial: OptimisticState = {
    triage: pendingTriage.map(toClientTriageItem),
    projects: projectRows,
    completedTasks: [],
    projectFiles: fileRows.map((f) => toClientProjectFile(f, signedFileUrl.get(f.fileUrl) ?? null)),
    tasks: rows
      .filter((t) => t.status !== "completed")
      .map((t) =>
        toClientTask(t, {
          proofCount: t.proofCount,
          thumbnails: thumbnailsByTask.get(t.id) ?? [],
          subtasks: subtaskRows.filter((s) => s.taskId === t.id),
        }),
      ),
  };

  return (
    <DashboardProvider initial={initial}>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">ThreeDoList</h1>
            <p className="truncate font-mono text-xs text-muted-foreground">{user.email}</p>
          </div>
          <form action={signOut}>
            <SubmitButton variant="ghost" size="icon-lg" aria-label="Sign out" title="Sign out" pendingLabel="…" className="text-muted-foreground">
              <LogOut />
            </SubmitButton>
          </form>
        </header>
        <DashboardShell
          initialTab={tab}
          initialProject={projectParam}
          receipts={receipts}
          canSyncGmail={Boolean(process.env.GMAIL_SYNC_WEBHOOK_URL)}
        />
      </main>
    </DashboardProvider>
  );
}
