import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { AddTaskForm } from "@/components/add-task-form";
import { BrainDumpBar } from "@/components/brain-dump-bar";
import { DayCalendar } from "@/components/day-calendar";
import { DashboardProvider } from "@/components/dashboard-provider";
import { ReceiptLog } from "@/components/receipt-log";
import { ProjectWorkspace } from "@/components/project-workspace";
import { TaskBoard } from "@/components/task-board";
import { EmailDumpBox } from "@/components/email-dump-box";
import { TriageBadge, TriageList } from "@/components/triage-list";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { projectFiles, projects, taskProofs, taskSubtasks, tasks, triageItems } from "@/db/schema";
import { loadReceipts } from "@/app/receipts";
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
  const showTriage = tab === "triage";
  const showCalendar = tab === "calendar";
  const showReceipts = tab === "receipts";
  await connection(); // per-user page: render at request time (auth/session code reads Date.now())
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Table names written out on purpose: in a single-table select Drizzle drops the "tasks." prefix from
  // ${tasks.id}, which would make this subquery compare task_proofs.task_id to its own id.
  const proofCount = sql<number>`(select count(*)::int from task_proofs where task_proofs.task_id = tasks.id)`;
  const rows = await db
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
      proofCount,
    })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.createdAt));

  // Private bucket: sign image proof paths for 1 hour so thumbnails can render.
  const imageProofs = await db
    .select({ id: taskProofs.id, taskId: taskProofs.taskId, path: taskProofs.storagePathOrUrl })
    .from(taskProofs)
    .innerJoin(tasks, eq(tasks.id, taskProofs.taskId))
    .where(and(eq(tasks.userId, user.id), eq(taskProofs.type, "image")));
  // One batched call, skipped entirely when there is nothing to sign.
  const { data: signed } = imageProofs.length
    ? await supabase.storage.from("proof-uploads").createSignedUrls(imageProofs.map((p) => p.path), 3600)
    : { data: null };
  const thumbnailsByTask = new Map<string, { id: string; url: string }[]>();
  imageProofs.forEach((p, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) thumbnailsByTask.set(p.taskId, [...(thumbnailsByTask.get(p.taskId) ?? []), { id: p.id, url }]);
  });

  const subtaskRows = await db
    .select({
      id: taskSubtasks.id,
      taskId: taskSubtasks.taskId,
      label: taskSubtasks.label,
      isCompleted: taskSubtasks.isCompleted,
      source: taskSubtasks.source,
    })
    .from(taskSubtasks)
    .innerJoin(tasks, eq(tasks.id, taskSubtasks.taskId))
    .where(eq(tasks.userId, user.id));

  const pendingTriage = await db
    .select({
      id: triageItems.id,
      sourceSubject: triageItems.sourceSubject,
      summary: triageItems.summary,
      suggestedAction: triageItems.suggestedAction,
      category: triageItems.category,
    })
    .from(triageItems)
    .where(and(eq(triageItems.userId, user.id), eq(triageItems.status, "pending")))
    .orderBy(desc(triageItems.createdAt));

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, color: projects.color })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(projects.createdAt);

  const receipts = showReceipts ? await loadReceipts(supabase, user.id) : [];

  const active = rows.filter((t) => t.status !== "completed");

  // Unknown ids (deleted project, hand-edited URL) fall back to "all".
  const selected =
    projectParam === "unassigned" || projectRows.some((p) => p.id === projectParam) ? projectParam! : "all";
  const selectedProject = projectRows.find((p) => p.id === selected);

  const optimisticTasks = active.map((t) => ({
    ...t,
    status: t.status,
    activeTimerStartedAt: t.activeTimerStartedAt?.toISOString() ?? null,
    scheduledStart: t.scheduledStart?.toISOString() ?? null,
    thumbnails: thumbnailsByTask.get(t.id) ?? [],
    subtasks: subtaskRows.filter((s) => s.taskId === t.id),
  }));

  let workspaceFiles: { id: string; fileName: string; href: string | null; isLink: boolean }[] = [];
  if (selectedProject) {
    const files = await db
      .select({ id: projectFiles.id, fileName: projectFiles.fileName, fileUrl: projectFiles.fileUrl })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, selectedProject.id))
      .orderBy(projectFiles.createdAt);
    const storagePaths = files.filter((f) => !isProjectLink(f.fileUrl)).map((f) => f.fileUrl);
    const { data: signedFiles } = storagePaths.length
      ? await supabase.storage.from("proof-uploads").createSignedUrls(storagePaths, 3600)
      : { data: null };
    workspaceFiles = files.map((f) => {
      const link = isProjectLink(f.fileUrl);
      const href = link ? f.fileUrl : signedFiles?.find((s) => s.path === f.fileUrl)?.signedUrl ?? null;
      return { id: f.id, fileName: f.fileName, href, isLink: link };
    });
  }

  return (
    <DashboardProvider triage={pendingTriage} tasks={optimisticTasks}>
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">ThreeDoList</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </header>

      <nav className="flex gap-2">
        <Link href="/" className={tabClass(!showTriage && !showCalendar && !showReceipts)}>Tasks</Link>
        <Link href="/?tab=calendar" className={tabClass(showCalendar)}>Calendar</Link>
        <Link href="/?tab=receipts" className={tabClass(showReceipts)}>Receipts</Link>
        <Link href="/?tab=triage" className={tabClass(showTriage)}>
          Triage<TriageBadge />
        </Link>
      </nav>

      {showCalendar ? (
        <DayCalendar />
      ) : showReceipts ? (
        <ReceiptLog receipts={receipts} projects={projectRows} />
      ) : showTriage ? (
        <>
          <EmailDumpBox canSyncGmail={Boolean(process.env.GMAIL_SYNC_WEBHOOK_URL)} />
          <BrainDumpBar />
          <TriageList />
        </>
      ) : (
        <>
      <AddTaskForm />

      <TaskBoard
        selected={selected}
        projects={projectRows}
        workspace={
          selectedProject && (
            <ProjectWorkspace projectId={selectedProject.id} name={selectedProject.name} files={workspaceFiles} />
          )
        }
      />

        </>
      )}
    </main>
    </DashboardProvider>
  );
}

const tabClass = (selected: boolean) =>
  `flex h-10 flex-1 items-center justify-center rounded-md border text-sm font-medium ${selected ? "bg-primary text-primary-foreground" : ""}`;
