import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { AddTaskForm } from "@/components/add-task-form";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { taskProofs, tasks } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
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
      title: tasks.title,
      completionType: tasks.completionType,
      estimatedMinutes: tasks.estimatedMinutes,
      actualMinutes: tasks.actualMinutes,
      activeTimerStartedAt: tasks.activeTimerStartedAt,
      status: tasks.status,
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
  const { data: signed } = await supabase.storage
    .from("proof-uploads")
    .createSignedUrls(imageProofs.map((p) => p.path), 3600);
  const thumbnailsByTask = new Map<string, { id: string; url: string }[]>();
  imageProofs.forEach((p, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) thumbnailsByTask.set(p.taskId, [...(thumbnailsByTask.get(p.taskId) ?? []), { id: p.id, url }]);
  });

  const active = rows.filter((t) => t.status !== "completed");
  const completed = rows.filter((t) => t.status === "completed");

  return (
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

      <AddTaskForm />

      <ul className="flex flex-col gap-3">
        {active.map((task) => (
          <TaskCard
            key={task.id}
            {...task}
            activeTimerStartedAt={task.activeTimerStartedAt?.toISOString() ?? null}
            thumbnails={thumbnailsByTask.get(task.id) ?? []}
          />
        ))}
        {active.length === 0 && <p className="text-muted-foreground">Nothing to do. Add a task above.</p>}
      </ul>

      <details>
        <summary className="cursor-pointer font-medium">Completed ({completed.length})</summary>
        <ul className="mt-2 flex flex-col gap-2">
          {completed.map((task) => (
            <li key={task.id} className="rounded-lg border p-3 text-sm text-muted-foreground">
              {task.title}
              {task.estimatedMinutes ? ` · Est ${task.estimatedMinutes}m` : ""}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
