import { describe, expect, it } from "vitest";
import { assertCanDeleteTask, assertCanUndoCompletion, filterReceiptTasks, findSpawnedCopy, formatReceiptVariance, reopenedStatus } from "./receipt-rules";

describe("assertCanUndoCompletion", () => {
  it("allows undoing the latest completed task", () => {
    expect(() => assertCanUndoCompletion({ id: "a", status: "completed" }, "a")).not.toThrow();
  });

  it("blocks undoing an older completed task", () => {
    expect(() => assertCanUndoCompletion({ id: "a", status: "completed" }, "b")).toThrow(/latest/i);
  });

  it("blocks undoing a task that is not completed", () => {
    expect(() => assertCanUndoCompletion({ id: "a", status: "todo" }, "a")).toThrow(/latest/i);
  });

  it("blocks when nothing is completed", () => {
    expect(() => assertCanUndoCompletion({ id: "a", status: "completed" }, null)).toThrow(/latest/i);
  });
});

describe("reopenedStatus", () => {
  it("returns to scheduled when the task still has a calendar slot", () => {
    expect(reopenedStatus("2026-11-18T09:00:00.000Z")).toBe("scheduled");
  });

  it("returns to todo when it was never scheduled", () => {
    expect(reopenedStatus(null)).toBe("todo");
  });
});

describe("findSpawnedCopy", () => {
  const original = { title: "Water plants", projectId: "p1", completedAt: new Date("2026-11-18T10:00:00Z") };
  const copy = {
    id: "c1", title: "Water plants", projectId: "p1", status: "todo" as const,
    createdAt: new Date("2026-11-18T10:00:01Z"), actualMinutes: 0, proofCount: 0, activeTimerStartedAt: null,
  };

  it("finds the untouched copy made at completion time", () => {
    expect(findSpawnedCopy([copy], original)).toBe("c1");
  });

  it("picks the newest when several match", () => {
    const newer = { ...copy, id: "c2", createdAt: new Date("2026-11-18T10:00:05Z") };
    expect(findSpawnedCopy([copy, newer], original)).toBe("c2");
  });

  it("ignores copies created before the completion", () => {
    expect(findSpawnedCopy([{ ...copy, createdAt: new Date("2026-11-18T09:00:00Z") }], original)).toBeNull();
  });

  it("ignores copies with a different title or project", () => {
    expect(findSpawnedCopy([{ ...copy, title: "Other" }], original)).toBeNull();
    expect(findSpawnedCopy([{ ...copy, projectId: "p2" }], original)).toBeNull();
  });

  it("never picks a copy that has been touched", () => {
    expect(findSpawnedCopy([{ ...copy, actualMinutes: 5 }], original)).toBeNull();
    expect(findSpawnedCopy([{ ...copy, proofCount: 1 }], original)).toBeNull();
    expect(findSpawnedCopy([{ ...copy, activeTimerStartedAt: new Date() }], original)).toBeNull();
    expect(findSpawnedCopy([{ ...copy, status: "completed" as const }], original)).toBeNull();
  });
});

describe("assertCanDeleteTask", () => {
  it("blocks deleting a completed task with a clear message", () => {
    expect(() => assertCanDeleteTask("completed")).toThrow(/completed/i);
  });

  it("allows deleting todo and scheduled tasks", () => {
    expect(() => assertCanDeleteTask("todo")).not.toThrow();
    expect(() => assertCanDeleteTask("scheduled")).not.toThrow();
  });
});

describe("filterReceiptTasks", () => {
  const tasks = [
    { title: "File Taxes", notes: "use form 1040", projectId: "p1", projectName: "Finance" },
    { title: "Buy milk", notes: null, projectId: null, projectName: null },
    { title: "Write report", notes: "Quarterly TAXES summary", projectId: "p2", projectName: "Work" },
    { title: "Plan trip", projectId: "p1", projectName: "Finance" },
  ];

  it("returns everything for an empty query and 'all'", () => {
    expect(filterReceiptTasks(tasks, "", "all")).toHaveLength(4);
    expect(filterReceiptTasks(tasks, "   ")).toHaveLength(4);
  });

  it("searches title case-insensitively", () => {
    expect(filterReceiptTasks(tasks, "MILK").map((t) => t.title)).toEqual(["Buy milk"]);
  });

  it("searches notes case-insensitively", () => {
    expect(filterReceiptTasks(tasks, "taxes").map((t) => t.title)).toEqual(["File Taxes", "Write report"]);
  });

  it("searches project name case-insensitively", () => {
    expect(filterReceiptTasks(tasks, "finance").map((t) => t.title)).toEqual(["File Taxes", "Plan trip"]);
  });

  it("filters by 'unassigned'", () => {
    expect(filterReceiptTasks(tasks, "", "unassigned").map((t) => t.title)).toEqual(["Buy milk"]);
  });

  it("filters by a specific projectId", () => {
    expect(filterReceiptTasks(tasks, "", "p2").map((t) => t.title)).toEqual(["Write report"]);
  });

  it("combines query and project filter", () => {
    expect(filterReceiptTasks(tasks, "taxes", "p1").map((t) => t.title)).toEqual(["File Taxes"]);
  });
});

describe("formatReceiptVariance", () => {
  it("handles an underestimated task (took longer)", () => {
    expect(formatReceiptVariance(30, 45)).toEqual({ label: "Est: 30m | Actual: 45m", deltaMinutes: 15 });
  });

  it("handles an overestimated task (took less)", () => {
    expect(formatReceiptVariance(60, 20)).toEqual({ label: "Est: 60m | Actual: 20m", deltaMinutes: -40 });
  });

  it("handles an exact estimate", () => {
    expect(formatReceiptVariance(25, 25)).toEqual({ label: "Est: 25m | Actual: 25m", deltaMinutes: 0 });
  });

  it("handles an unestimated task", () => {
    expect(formatReceiptVariance(null, 15)).toEqual({ label: "Est: — | Actual: 15m", deltaMinutes: null });
  });
});
