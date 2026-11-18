export type TaskStatus = "todo" | "scheduled" | "completed";

export function assertCanDeleteTask(status: TaskStatus): void {
  if (status === "completed") throw new Error("Completed tasks are kept in the Receipt Log and can't be deleted.");
}

export function filterReceiptTasks<
  T extends { title: string; notes?: string | null; reflection?: string | null; projectId?: string | null; projectName?: string | null },
>(tasks: T[], query: string, projectId: string | "all" | "unassigned" = "all"): T[] {
  const needle = query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (projectId === "unassigned" ? t.projectId != null : projectId !== "all" && t.projectId !== projectId) return false;
    return [t.title, t.notes, t.reflection, t.projectName].some((field) => field?.toLowerCase().includes(needle));
  });
}

const MAX_REFLECTION_LENGTH = 5000;

// Blank means "cleared", stored as null.
export function normalizeReflection(raw: string): string | null {
  const text = raw.trim();
  if (text.length > MAX_REFLECTION_LENGTH) throw new Error(`Reflection must be ${MAX_REFLECTION_LENGTH} characters or fewer.`);
  return text || null;
}

// deltaMinutes = actual - estimated (positive means it took longer); null when unestimated.
export function formatReceiptVariance(
  estimatedMinutes: number | null,
  actualMinutes: number,
): { label: string; deltaMinutes: number | null } {
  return {
    label: `Est: ${estimatedMinutes === null ? "—" : `${estimatedMinutes}m`} | Actual: ${actualMinutes}m`,
    deltaMinutes: estimatedMinutes === null ? null : actualMinutes - estimatedMinutes,
  };
}

// Receipts are meant to be set in stone, so only the newest completion can be taken back (a mis-click, not a rewrite of history).
export function assertCanUndoCompletion(task: { id: string; status: TaskStatus }, latestCompletedId: string | null): void {
  if (task.status !== "completed" || task.id !== latestCompletedId) throw new Error("Only the latest completed task can be undone.");
}

export const reopenedStatus = (scheduledStart: Date | string | null): "todo" | "scheduled" => (scheduledStart ? "scheduled" : "todo");

// The repeat copy that completeTask spawned: same title/project, made at or after completion, and still untouched.
// Newest wins; a copy you've started working on is never returned.
export function findSpawnedCopy(
  candidates: {
    id: string; title: string; projectId: string | null; status: TaskStatus; createdAt: Date;
    actualMinutes: number; proofCount: number; activeTimerStartedAt: Date | null;
  }[],
  original: { title: string; projectId: string | null; completedAt: Date },
): string | null {
  const matches = candidates.filter(
    (c) =>
      c.title === original.title && c.projectId === original.projectId && c.status === "todo" &&
      c.createdAt >= original.completedAt && c.actualMinutes === 0 && c.proofCount === 0 && !c.activeTimerStartedAt,
  );
  return matches.sort((a, b) => +b.createdAt - +a.createdAt)[0]?.id ?? null;
}
