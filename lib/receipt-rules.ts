export type TaskStatus = "todo" | "scheduled" | "completed";

export function assertCanDeleteTask(status: TaskStatus): void {
  throw new Error("not implemented");
}

export function filterReceiptTasks<
  T extends { title: string; notes?: string | null; projectId?: string | null; projectName?: string | null },
>(tasks: T[], query: string, projectId: string | "all" | "unassigned" = "all"): T[] {
  throw new Error("not implemented");
}

// deltaMinutes = actual - estimated (positive means it took longer); null when unestimated.
export function formatReceiptVariance(
  estimatedMinutes: number | null,
  actualMinutes: number,
): { label: string; deltaMinutes: number | null } {
  throw new Error("not implemented");
}
