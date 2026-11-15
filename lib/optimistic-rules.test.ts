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
