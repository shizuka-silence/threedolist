export type TaskStatus = "todo" | "scheduled" | "completed";

export function assertCanDeleteTask(status: TaskStatus): void {
  if (status === "completed") throw new Error("Completed tasks are kept in the Receipt Log and can't be deleted.");
}

export function filterReceiptTasks<
  T extends { title: string; notes?: string | null; projectId?: string | null; projectName?: string | null },
>(tasks: T[], query: string, projectId: string | "all" | "unassigned" = "all"): T[] {
  const needle = query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (projectId === "unassigned" ? t.projectId != null : projectId !== "all" && t.projectId !== projectId) return false;
    return [t.title, t.notes, t.projectName].some((field) => field?.toLowerCase().includes(needle));
  });
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
