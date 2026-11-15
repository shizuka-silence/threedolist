import { describe, expect, it } from "vitest";
import { assertCanDeleteTask, filterReceiptTasks, formatReceiptVariance } from "./receipt-rules";

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
