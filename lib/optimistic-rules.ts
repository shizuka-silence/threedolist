import type { TriageCategory } from "@/lib/triage-rules";

// Pure reducer behind the dashboard's instant (optimistic) UI. React-free so it can be unit tested.

export type OptimisticTriageItem = {
  id: string;
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
};

export type OptimisticSubtask = { id: string; label: string; isCompleted: boolean; source: "user" | "ai_pitfall" };

export type OptimisticTask = {
  id: string;
  projectId: string | null;
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes: number | null;
  actualMinutes: number;
  activeTimerStartedAt: string | null; // ISO
  status: "todo" | "scheduled" | "completed";
  scheduledStart: string | null; // ISO
  aiClarifyingQuestions: string[] | null;
  proofCount: number;
  thumbnails: { id: string; url: string }[];
  subtasks: OptimisticSubtask[];
};

export type OptimisticState = { triage: OptimisticTriageItem[]; tasks: OptimisticTask[] };

export type OptimisticChange =
  | { type: "triage/reclassify"; id: string; category: TriageCategory }
  | { type: "triage/remove"; id: string }
  | { type: "triage/add"; item: OptimisticTriageItem }
  | { type: "triage/promote"; id: string; task: OptimisticTask }
  | { type: "task/addSubtask"; taskId: string; subtask: OptimisticSubtask }
  | { type: "task/toggleSubtask"; taskId: string; subtaskId: string }
  | { type: "task/complete"; id: string }
  | { type: "task/assign"; id: string; projectId: string | null }
  | { type: "task/setEstimate"; id: string; minutes: number | null }
  | { type: "task/schedule"; id: string; start: string }
  | { type: "task/unschedule"; id: string };

export function buildOptimisticTask(id: string, title: string, completionType: "tick" | "proof"): OptimisticTask {
  return {
    id, title, completionType, projectId: null, estimatedMinutes: null, actualMinutes: 0, activeTimerStartedAt: null,
    status: "todo", scheduledStart: null, aiClarifyingQuestions: null, proofCount: 0, thumbnails: [], subtasks: [],
  };
}

export function applyOptimisticChange(state: OptimisticState, change: OptimisticChange): OptimisticState {
  const editTask = (id: string, edit: (t: OptimisticTask) => OptimisticTask) => ({
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? edit(t) : t)),
  });

  switch (change.type) {
    case "triage/reclassify":
      return { ...state, triage: state.triage.map((i) => (i.id === change.id ? { ...i, category: change.category } : i)) };
    case "triage/remove":
      return { ...state, triage: state.triage.filter((i) => i.id !== change.id) };
    case "triage/add":
      return { ...state, triage: [change.item, ...state.triage] };
    case "triage/promote":
      return { triage: state.triage.filter((i) => i.id !== change.id), tasks: [change.task, ...state.tasks] };
    case "task/addSubtask":
      return editTask(change.taskId, (t) => ({ ...t, subtasks: [...t.subtasks, change.subtask] }));
    case "task/toggleSubtask":
      return editTask(change.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === change.subtaskId ? { ...s, isCompleted: !s.isCompleted } : s)),
      }));
    case "task/complete":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== change.id) };
    case "task/assign":
      return editTask(change.id, (t) => ({ ...t, projectId: change.projectId }));
    case "task/setEstimate":
      return editTask(change.id, (t) => ({ ...t, estimatedMinutes: change.minutes }));
    case "task/schedule":
      return editTask(change.id, (t) => ({ ...t, scheduledStart: change.start, status: "scheduled" }));
    case "task/unschedule":
      return editTask(change.id, (t) => ({ ...t, scheduledStart: null, status: "todo" }));
  }
}
