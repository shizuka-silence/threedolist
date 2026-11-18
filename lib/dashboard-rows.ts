import type { OptimisticProjectFile, OptimisticSubtask, OptimisticTask, OptimisticTriageItem } from "@/lib/optimistic-rules";
import { isProjectLink } from "./project-rules";

// DB row -> client state shape (Dates become ISO strings). Shared by app/page.tsx and the Server Actions
// that hand a fresh row back to the client, so the shape is defined once.

type TaskRow = {
  id: string;
  projectId: string | null;
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes: number | null;
  actualMinutes: number;
  activeTimerStartedAt: Date | null;
  status: "todo" | "scheduled" | "completed";
  scheduledStart: Date | null;
  aiClarifyingQuestions: string[] | null;
  deadline: Date | null;
  repeatEvery: number | null;
  repeatWeekdays: number[] | null;
  repeatUnit: "day" | "week" | "month" | null;
  repeatUntil: Date | null;
};

export function toClientTask(
  row: TaskRow,
  extra: { proofCount?: number; thumbnails?: { id: string; url: string }[]; subtasks?: OptimisticSubtask[] } = {},
): OptimisticTask {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    completionType: row.completionType,
    estimatedMinutes: row.estimatedMinutes,
    actualMinutes: row.actualMinutes,
    activeTimerStartedAt: row.activeTimerStartedAt?.toISOString() ?? null,
    status: row.status,
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    aiClarifyingQuestions: row.aiClarifyingQuestions,
    deadline: row.deadline?.toISOString() ?? null,
    repeatEvery: row.repeatEvery,
    repeatWeekdays: row.repeatWeekdays,
    repeatUnit: row.repeatUnit,
    repeatUntil: row.repeatUntil?.toISOString() ?? null,
    proofCount: extra.proofCount ?? 0,
    thumbnails: extra.thumbnails ?? [],
    subtasks: extra.subtasks ?? [],
  };
}

export function toClientTriageItem(row: Omit<OptimisticTriageItem, "deadline"> & { deadline: Date | null }): OptimisticTriageItem {
  return { ...row, deadline: row.deadline?.toISOString() ?? null };
}

// Clients pick the id of rows they create so the UI can show them before the save returns.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

// href is the link itself, or a signed URL for a Storage file (null if signing failed).
export function toClientProjectFile(
  row: { id: string; projectId: string; fileName: string; fileUrl: string },
  signedUrl: string | null,
): OptimisticProjectFile {
  const isLink = isProjectLink(row.fileUrl);
  return { id: row.id, projectId: row.projectId, fileName: row.fileName, href: isLink ? row.fileUrl : signedUrl, isLink };
}
