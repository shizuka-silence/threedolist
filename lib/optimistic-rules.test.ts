import { describe, expect, it } from "vitest";
import { applyOptimisticChange, buildOptimisticTask, type OptimisticState, type OptimisticTask } from "./optimistic-rules";

const task = (over: Partial<OptimisticTask> = {}): OptimisticTask => ({
  ...buildOptimisticTask("t1", "Write report", "tick"),
  ...over,
});

const item = (id: string, category: "announcement" | "requirement" | "opportunity" | "reply" = "requirement") => ({
  id, category, sourceSubject: `Subject ${id}`, summary: null, suggestedAction: null,
});

const state = (over: Partial<OptimisticState> = {}): OptimisticState => ({
  triage: [item("a"), item("b")],
  tasks: [task({ id: "t1" }), task({ id: "t2", projectId: "p1" })],
  projects: [{ id: "p1", name: "Taxes", color: "#111111" }],
  projectFiles: [{ id: "f1", projectId: "p1", fileName: "W2.pdf", href: "https://x/w2", isLink: false }],
  completedTasks: [],
  ...over,
});

describe("buildOptimisticTask", () => {
  it("builds an empty, unassigned todo task with the given id, title and type", () => {
    expect(buildOptimisticTask("tmp", "Reply to Sam", "proof")).toMatchObject({
      id: "tmp", title: "Reply to Sam", completionType: "proof", status: "todo", projectId: null,
      estimatedMinutes: null, actualMinutes: 0, proofCount: 0, subtasks: [], thumbnails: [], scheduledStart: null,
    });
  });
});

describe("triage changes", () => {
  it("reclassify moves only the matching item to the new category", () => {
    const next = applyOptimisticChange(state(), { type: "triage/reclassify", id: "a", category: "reply" });
    expect(next.triage.map((i) => [i.id, i.category])).toEqual([["a", "reply"], ["b", "requirement"]]);
  });

  it("remove drops the item (acknowledge / no / dismiss)", () => {
    const next = applyOptimisticChange(state(), { type: "triage/remove", id: "a" });
    expect(next.triage.map((i) => i.id)).toEqual(["b"]);
  });

  it("add puts the pending card first", () => {
    const next = applyOptimisticChange(state(), { type: "triage/add", item: item("new") });
    expect(next.triage.map((i) => i.id)).toEqual(["new", "a", "b"]);
  });

  it("promote removes the item and adds the task at the top of the list", () => {
    const promoted = task({ id: "tmp", title: "Promoted" });
    const next = applyOptimisticChange(state(), { type: "triage/promote", id: "a", task: promoted });
    expect(next.triage.map((i) => i.id)).toEqual(["b"]);
    expect(next.tasks.map((t) => t.id)).toEqual(["tmp", "t1", "t2"]);
  });
});

describe("task changes", () => {
  it("addSubtask appends to the right task only", () => {
    const subtask = { id: "s1", label: "Draft", isCompleted: false, source: "user" as const };
    const next = applyOptimisticChange(state(), { type: "task/addSubtask", taskId: "t1", subtask });
    expect(next.tasks[0].subtasks).toEqual([subtask]);
    expect(next.tasks[1].subtasks).toEqual([]);
  });

  it("toggleSubtask flips only the matching subtask", () => {
    const subtasks = [
      { id: "s1", label: "A", isCompleted: false, source: "user" as const },
      { id: "s2", label: "B", isCompleted: true, source: "ai_pitfall" as const },
    ];
    const s = state({ tasks: [task({ id: "t1", subtasks })] });
    const next = applyOptimisticChange(s, { type: "task/toggleSubtask", taskId: "t1", subtaskId: "s1" });
    expect(next.tasks[0].subtasks.map((x) => x.isCompleted)).toEqual([true, true]);
    const back = applyOptimisticChange(next, { type: "task/toggleSubtask", taskId: "t1", subtaskId: "s2" });
    expect(back.tasks[0].subtasks.map((x) => x.isCompleted)).toEqual([true, false]);
  });

  it("complete removes the task from the active list", () => {
    const next = applyOptimisticChange(state(), { type: "task/complete", id: "t1" });
    expect(next.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("assign sets or clears the project", () => {
    const assigned = applyOptimisticChange(state(), { type: "task/assign", id: "t1", projectId: "p9" });
    expect(assigned.tasks.map((t) => t.projectId)).toEqual(["p9", "p1"]);
    const cleared = applyOptimisticChange(assigned, { type: "task/assign", id: "t2", projectId: null });
    expect(cleared.tasks.map((t) => t.projectId)).toEqual(["p9", null]);
  });

  it("setEstimate sets or clears the estimate", () => {
    const set = applyOptimisticChange(state(), { type: "task/setEstimate", id: "t1", minutes: 45 });
    expect(set.tasks[0].estimatedMinutes).toBe(45);
    const cleared = applyOptimisticChange(set, { type: "task/setEstimate", id: "t1", minutes: null });
    expect(cleared.tasks[0].estimatedMinutes).toBeNull();
  });

  it("schedule sets the start and status; unschedule resets both", () => {
    const scheduled = applyOptimisticChange(state(), { type: "task/schedule", id: "t1", start: "2026-11-15T09:00:00.000Z" });
    expect(scheduled.tasks[0]).toMatchObject({ scheduledStart: "2026-11-15T09:00:00.000Z", status: "scheduled" });
    const unscheduled = applyOptimisticChange(scheduled, { type: "task/unschedule", id: "t1" });
    expect(unscheduled.tasks[0]).toMatchObject({ scheduledStart: null, status: "todo" });
  });

  it("ignores changes for ids that are not in the state", () => {
    const s = state();
    expect(applyOptimisticChange(s, { type: "task/assign", id: "missing", projectId: "p1" })).toEqual(s);
    expect(applyOptimisticChange(s, { type: "triage/reclassify", id: "missing", category: "reply" })).toEqual(s);
  });

  it("does not mutate the previous state", () => {
    const s = state();
    const snapshot = structuredClone(s);
    applyOptimisticChange(s, { type: "task/complete", id: "t1" });
    applyOptimisticChange(s, { type: "triage/remove", id: "a" });
    expect(s).toEqual(snapshot);
  });
});

describe("server-returned rows (upsert)", () => {
  it("task/upsert inserts a new task at the top", () => {
    const next = applyOptimisticChange(state(), { type: "task/upsert", task: task({ id: "new" }) });
    expect(next.tasks.map((t) => t.id)).toEqual(["new", "t1", "t2"]);
  });

  it("task/upsert replaces an existing task with the same id in place", () => {
    const next = applyOptimisticChange(state(), { type: "task/upsert", task: task({ id: "t2", title: "Renamed" }) });
    expect(next.tasks.map((t) => [t.id, t.title])).toEqual([["t1", "Write report"], ["t2", "Renamed"]]);
  });

  it("task/upsert swaps a temp id for the real row when `replaces` is given", () => {
    const s = state({ tasks: [task({ id: "tmp" }), task({ id: "t2" })] });
    const next = applyOptimisticChange(s, { type: "task/upsert", task: task({ id: "real" }), replaces: "tmp" });
    expect(next.tasks.map((t) => t.id)).toEqual(["real", "t2"]);
  });

  it("triage/upsert inserts first, or swaps a temp id", () => {
    const added = applyOptimisticChange(state(), { type: "triage/upsert", item: item("new") });
    expect(added.triage.map((i) => i.id)).toEqual(["new", "a", "b"]);
    const swapped = applyOptimisticChange(added, { type: "triage/upsert", item: item("real"), replaces: "new" });
    expect(swapped.triage.map((i) => i.id)).toEqual(["real", "a", "b"]);
  });

  it("project/upsert and file/upsert append new rows", () => {
    const withProject = applyOptimisticChange(state(), { type: "project/upsert", project: { id: "p2", name: "Gym", color: "#222222" } });
    expect(withProject.projects.map((p) => p.id)).toEqual(["p1", "p2"]);
    const file = { id: "f2", projectId: "p1", fileName: "Docs", href: "https://x/docs", isLink: true };
    const withFile = applyOptimisticChange(state(), { type: "file/upsert", file });
    expect(withFile.projectFiles.map((f) => f.id)).toEqual(["f1", "f2"]);
  });
});

describe("completed this session (feeds the Receipts tab)", () => {
  it("complete moves the task into completedTasks, newest first, stamped with the given time", () => {
    const first = applyOptimisticChange(state(), { type: "task/complete", id: "t1", at: "2026-11-17T10:00:00.000Z" });
    expect(first.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(first.completedTasks).toMatchObject([{ id: "t1", status: "completed", completedAt: "2026-11-17T10:00:00.000Z" }]);
    const second = applyOptimisticChange(first, { type: "task/complete", id: "t2", at: "2026-11-17T11:00:00.000Z" });
    expect(second.completedTasks.map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("complete without a time still moves the task (completedAt is null)", () => {
    const next = applyOptimisticChange(state(), { type: "task/complete", id: "t1" });
    expect(next.completedTasks).toMatchObject([{ id: "t1", completedAt: null }]);
  });

  it("deleting a task does not add it to completedTasks", () => {
    const next = applyOptimisticChange(state(), { type: "task/remove", id: "t1" });
    expect(next.completedTasks).toEqual([]);
  });

  it("completing an unknown id changes nothing", () => {
    const s = state();
    expect(applyOptimisticChange(s, { type: "task/complete", id: "missing", at: "x" })).toEqual(s);
  });
});

describe("removals", () => {
  it("task/remove drops the task (delete)", () => {
    const next = applyOptimisticChange(state(), { type: "task/remove", id: "t1" });
    expect(next.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("project/remove drops the project and its files, and un-assigns its tasks", () => {
    const next = applyOptimisticChange(state(), { type: "project/remove", id: "p1" });
    expect(next.projects).toEqual([]);
    expect(next.projectFiles).toEqual([]);
    expect(next.tasks.map((t) => t.projectId)).toEqual([null, null]);
  });

  it("file/remove drops only that file", () => {
    const next = applyOptimisticChange(state(), { type: "file/remove", id: "f1" });
    expect(next.projectFiles).toEqual([]);
    expect(next.projects).toHaveLength(1);
  });
});

describe("timer, proof and AI prep", () => {
  it("startTimer sets the start time", () => {
    const next = applyOptimisticChange(state(), { type: "task/startTimer", id: "t1", at: "2026-11-17T10:00:00.000Z" });
    expect(next.tasks[0].activeTimerStartedAt).toBe("2026-11-17T10:00:00.000Z");
  });

  it("stopTimer adds the logged minutes and clears the start time", () => {
    const s = state({ tasks: [task({ id: "t1", actualMinutes: 10, activeTimerStartedAt: "2026-11-17T10:00:00.000Z" })] });
    const next = applyOptimisticChange(s, { type: "task/stopTimer", id: "t1", minutes: 25 });
    expect(next.tasks[0]).toMatchObject({ actualMinutes: 35, activeTimerStartedAt: null });
  });

  it("addProof bumps proofCount and appends a thumbnail only when given one", () => {
    const withThumb = applyOptimisticChange(state(), { type: "task/addProof", id: "t1", thumbnail: { id: "pr1", url: "https://x/1" } });
    expect(withThumb.tasks[0]).toMatchObject({ proofCount: 1, thumbnails: [{ id: "pr1", url: "https://x/1" }] });
    const noThumb = applyOptimisticChange(withThumb, { type: "task/addProof", id: "t1" });
    expect(noThumb.tasks[0]).toMatchObject({ proofCount: 2 });
    expect(noThumb.tasks[0].thumbnails).toHaveLength(1);
  });

  it("setPrep fills an empty estimate, never overwrites a manual one", () => {
    const prep = { type: "task/setPrep" as const, id: "t1", estimatedMinutes: 30, questions: ["Who signs?"], pitfalls: [] };
    expect(applyOptimisticChange(state(), prep).tasks[0].estimatedMinutes).toBe(30);
    const manual = state({ tasks: [task({ id: "t1", estimatedMinutes: 90 })] });
    expect(applyOptimisticChange(manual, prep).tasks[0].estimatedMinutes).toBe(90);
  });

  it("setPrep sets the questions and replaces old AI pitfalls but keeps user subtasks", () => {
    const user = { id: "s1", label: "Mine", isCompleted: false, source: "user" as const };
    const oldPitfall = { id: "s2", label: "Old trap", isCompleted: false, source: "ai_pitfall" as const };
    const newPitfall = { id: "s3", label: "New trap", isCompleted: false, source: "ai_pitfall" as const };
    const s = state({ tasks: [task({ id: "t1", subtasks: [user, oldPitfall] })] });
    const next = applyOptimisticChange(s, { type: "task/setPrep", id: "t1", estimatedMinutes: null, questions: ["Q1", "Q2"], pitfalls: [newPitfall] });
    expect(next.tasks[0].aiClarifyingQuestions).toEqual(["Q1", "Q2"]);
    expect(next.tasks[0].subtasks.map((x) => x.id)).toEqual(["s1", "s3"]);
  });

  it("new changes ignore unknown ids and do not mutate state", () => {
    const s = state();
    const snapshot = structuredClone(s);
    expect(applyOptimisticChange(s, { type: "task/startTimer", id: "missing", at: "x" })).toEqual(s);
    expect(applyOptimisticChange(s, { type: "task/remove", id: "missing" })).toEqual(s);
    applyOptimisticChange(s, { type: "project/remove", id: "p1" });
    applyOptimisticChange(s, { type: "task/upsert", task: task({ id: "new" }) });
    expect(s).toEqual(snapshot);
  });
});
