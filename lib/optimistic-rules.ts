import type { TriageCategory } from "@/lib/triage-rules";

// Pure reducer behind the dashboard's instant (optimistic) UI. React-free so it can be unit tested.

export type OptimisticTriageItem = {
  id: string;
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
  sourceUrl?: string | null;
  deadline?: string | null; // ISO
  sourceBody?: string | null;
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
  deadline: string | null; // ISO
  repeatEvery: number | null;
  repeatWeekdays: number[] | null;
  repeatUnit: "day" | "week" | "month" | null;
  repeatUntil: string | null; // ISO
  proofCount: number;
  thumbnails: { id: string; url: string }[];
  subtasks: OptimisticSubtask[];
};

export type TaskSchedule = Pick<OptimisticTask, "deadline" | "repeatEvery" | "repeatWeekdays" | "repeatUnit" | "repeatUntil">;

export type OptimisticProject = { id: string; name: string; color: string };
export type OptimisticProjectFile = { id: string; projectId: string; fileName: string; href: string | null; isLink: boolean };

// Finished during this session; the Receipts tab shows these before the next page load.
export type CompletedTask = OptimisticTask & { completedAt: string | null };

export type OptimisticState = {
  triage: OptimisticTriageItem[];
  tasks: OptimisticTask[];
  projects: OptimisticProject[];
  projectFiles: OptimisticProjectFile[];
  completedTasks: CompletedTask[];
};

export type OptimisticChange =
  | { type: "triage/reclassify"; id: string; category: TriageCategory }
  | { type: "triage/remove"; id: string }
  | { type: "triage/add"; item: OptimisticTriageItem }
  | { type: "triage/promote"; id: string; task: OptimisticTask }
  | { type: "task/addSubtask"; taskId: string; subtask: OptimisticSubtask }
  | { type: "task/toggleSubtask"; taskId: string; subtaskId: string }
  | { type: "task/complete"; id: string; at?: string }
  | { type: "task/assign"; id: string; projectId: string | null }
  | { type: "task/setEstimate"; id: string; minutes: number | null }
  | { type: "task/rename"; id: string; title: string }
  | { type: "task/setSchedule"; id: string; schedule: TaskSchedule }
  | { type: "task/schedule"; id: string; start: string }
  | { type: "task/unschedule"; id: string }
  // Rows the server returned. `replaces` swaps a temp-id placeholder for the real row.
  | { type: "task/upsert"; task: OptimisticTask; replaces?: string }
  | { type: "triage/upsert"; item: OptimisticTriageItem; replaces?: string }
  | { type: "project/upsert"; project: OptimisticProject }
  | { type: "project/reorder"; ids: string[] }
  | { type: "file/upsert"; file: OptimisticProjectFile }
  | { type: "task/remove"; id: string }
  | { type: "project/remove"; id: string }
  | { type: "file/remove"; id: string }
  | { type: "task/startTimer"; id: string; at: string }
  | { type: "task/stopTimer"; id: string; minutes: number }
  | { type: "task/addMinutes"; id: string; minutes: number }
  | { type: "task/addProof"; id: string; thumbnail?: { id: string; url: string } }
  | { type: "task/setPrep"; id: string; estimatedMinutes: number | null; questions: string[] | null; pitfalls: OptimisticSubtask[] };

// Insert at the top, or replace in place when the id (or the temp id in `replaces`) already exists.
function upsertFirst<T extends { id: string }>(list: T[], row: T, replaces?: string): T[] {
  const at = list.findIndex((x) => x.id === (replaces ?? row.id));
  if (at === -1) return [row, ...list];
  return list.map((x, i) => (i === at ? row : x));
}

export function buildOptimisticTask(id: string, title: string, completionType: "tick" | "proof", deadline: string | null = null): OptimisticTask {
  return {
    id, title, completionType, projectId: null, estimatedMinutes: null, actualMinutes: 0, activeTimerStartedAt: null,
    status: "todo", scheduledStart: null, aiClarifyingQuestions: null, deadline, repeatEvery: null, repeatWeekdays: null, repeatUnit: null,
    repeatUntil: null, proofCount: 0, thumbnails: [], subtasks: [],
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
      return { ...state, triage: state.triage.filter((i) => i.id !== change.id), tasks: [change.task, ...state.tasks] };
    case "task/addSubtask":
      return editTask(change.taskId, (t) => ({ ...t, subtasks: [...t.subtasks, change.subtask] }));
    case "task/toggleSubtask":
      return editTask(change.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === change.subtaskId ? { ...s, isCompleted: !s.isCompleted } : s)),
      }));
    case "task/complete": {
      const done = state.tasks.find((t) => t.id === change.id);
      if (!done) return state;
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== change.id),
        completedTasks: [{ ...done, status: "completed", activeTimerStartedAt: null, completedAt: change.at ?? null }, ...state.completedTasks],
      };
    }
    case "task/assign":
      return editTask(change.id, (t) => ({ ...t, projectId: change.projectId }));
    case "task/setEstimate":
      return editTask(change.id, (t) => ({ ...t, estimatedMinutes: change.minutes }));
    case "task/rename":
      return editTask(change.id, (t) => ({ ...t, title: change.title }));
    case "task/setSchedule":
      return editTask(change.id, (t) => ({ ...t, ...change.schedule }));
    case "task/schedule":
      return editTask(change.id, (t) => ({ ...t, scheduledStart: change.start, status: "scheduled" }));
    case "task/unschedule":
      return editTask(change.id, (t) => ({ ...t, scheduledStart: null, status: "todo" }));
    case "task/upsert":
      return { ...state, tasks: upsertFirst(state.tasks, change.task, change.replaces) };
    case "triage/upsert":
      return { ...state, triage: upsertFirst(state.triage, change.item, change.replaces) };
    case "project/upsert":
      // Replace in place so a rename or recolor keeps the folder's slot; only new projects go last.
      return state.projects.some((p) => p.id === change.project.id)
        ? { ...state, projects: state.projects.map((p) => (p.id === change.project.id ? change.project : p)) }
        : { ...state, projects: [...state.projects, change.project] };
    case "project/reorder": {
      const rank = (id: string) => { const i = change.ids.indexOf(id); return i === -1 ? change.ids.length : i; };
      return { ...state, projects: [...state.projects].sort((a, b) => rank(a.id) - rank(b.id)) }; // stable sort keeps unknown ids in order
    }
    case "task/addMinutes":
      return editTask(change.id, (t) => ({ ...t, actualMinutes: t.actualMinutes + change.minutes }));
    case "file/upsert":
      return { ...state, projectFiles: [...state.projectFiles.filter((f) => f.id !== change.file.id), change.file] };
    case "task/remove":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== change.id) };
    case "project/remove":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== change.id),
        projectFiles: state.projectFiles.filter((f) => f.projectId !== change.id),
        tasks: state.tasks.map((t) => (t.projectId === change.id ? { ...t, projectId: null } : t)),
      };
    case "file/remove":
      return { ...state, projectFiles: state.projectFiles.filter((f) => f.id !== change.id) };
    case "task/startTimer":
      return editTask(change.id, (t) => ({ ...t, activeTimerStartedAt: change.at }));
    case "task/stopTimer":
      return editTask(change.id, (t) => ({ ...t, actualMinutes: t.actualMinutes + change.minutes, activeTimerStartedAt: null }));
    case "task/addProof":
      return editTask(change.id, (t) => ({
        ...t,
        proofCount: t.proofCount + 1,
        thumbnails: change.thumbnail ? [...t.thumbnails, change.thumbnail] : t.thumbnails,
      }));
    case "task/setPrep":
      return editTask(change.id, (t) => ({
        ...t,
        estimatedMinutes: t.estimatedMinutes ?? change.estimatedMinutes, // never overwrite a manual estimate
        aiClarifyingQuestions: change.questions ?? t.aiClarifyingQuestions,
        subtasks: [...t.subtasks.filter((s) => s.source !== "ai_pitfall"), ...change.pitfalls],
      }));
  }
}
