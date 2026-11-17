import { describe, expect, it } from "vitest";
import {
  buildSlotTimestamp, computeBlockHeightPx, formatVarianceBadge, groupTasksByDay, monthGrid, shiftDate, weekDays,
} from "./calendar-rules";

describe("computeBlockHeightPx", () => {
  it("scales height proportionally to estimated minutes", () => {
    expect(computeBlockHeightPx(60, 60)).toBe(60);
    expect(computeBlockHeightPx(30, 60)).toBe(30);
    expect(computeBlockHeightPx(90, 80)).toBe(120);
  });

  it("defaults to 64px per hour", () => {
    expect(computeBlockHeightPx(60)).toBe(64);
  });

  it("falls back to 30 minutes when the estimate is null", () => {
    expect(computeBlockHeightPx(null, 60)).toBe(30);
  });

  it("falls back to 30 minutes when the estimate is 0", () => {
    expect(computeBlockHeightPx(0, 60)).toBe(30);
  });
});

describe("formatVarianceBadge", () => {
  it("formats estimate and actual minutes", () => {
    expect(formatVarianceBadge(45, 50)).toBe("Est: 45m | Actual: 50m");
  });

  it("does not editorialize when actual is under or over the estimate", () => {
    expect(formatVarianceBadge(60, 20)).toBe("Est: 60m | Actual: 20m");
    expect(formatVarianceBadge(20, 60)).toBe("Est: 20m | Actual: 60m");
  });

  it("shows a placeholder when there is no estimate", () => {
    expect(formatVarianceBadge(null, 15)).toBe("Est: -- | Actual: 15m");
  });

  it("shows 0m when nothing has been logged yet", () => {
    expect(formatVarianceBadge(30, 0)).toBe("Est: 30m | Actual: 0m");
  });
});

describe("buildSlotTimestamp", () => {
  it("builds a local-time Date for the given day, hour and minute", () => {
    const d = buildSlotTimestamp("2026-03-09", 14, 30);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it("supports the top of the hour", () => {
    const d = buildSlotTimestamp("2026-12-31", 6, 0);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(6);
    expect(d.getMinutes()).toBe(0);
  });

  it("throws on a malformed day string", () => {
    expect(() => buildSlotTimestamp("not-a-date", 9, 0)).toThrow();
  });
});

describe("weekDays", () => {
  it("returns the Sunday-to-Saturday week containing the day", () => {
    expect(weekDays("2026-11-17")).toEqual([
      "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21",
    ]);
  });

  it("starts on the day itself when it is a Sunday", () => {
    expect(weekDays("2026-11-15")[0]).toBe("2026-11-15");
  });

  it("crosses month and year boundaries", () => {
    expect(weekDays("2026-12-31")).toEqual([
      "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02",
    ]);
  });
});

describe("monthGrid", () => {
  it("covers whole Sunday-to-Saturday weeks including neighbouring months", () => {
    const grid = monthGrid("2026-11-17");
    expect(grid).toHaveLength(35);
    expect(grid[0]).toBe("2026-11-01");
    expect(grid[34]).toBe("2026-12-05");
  });

  it("uses only 4 rows when the month fits exactly", () => {
    const grid = monthGrid("2026-02-10"); // Feb 2026 runs Sunday to Saturday
    expect(grid).toHaveLength(28);
    expect(grid[0]).toBe("2026-02-01");
    expect(grid[27]).toBe("2026-02-28");
  });

  it("uses 6 rows when the month spans six weeks", () => {
    const grid = monthGrid("2026-08-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-07-26");
    expect(grid[41]).toBe("2026-09-05");
  });
});

describe("shiftDate", () => {
  it("moves by days and weeks", () => {
    expect(shiftDate("2026-02-28", "day", 1)).toBe("2026-03-01");
    expect(shiftDate("2026-03-02", "week", -1)).toBe("2026-02-23");
  });

  it("moves by months across a year boundary", () => {
    expect(shiftDate("2026-12-15", "month", 1)).toBe("2027-01-15");
    expect(shiftDate("2026-01-15", "month", -1)).toBe("2025-12-15");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(shiftDate("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(shiftDate("2024-01-31", "month", 1)).toBe("2024-02-29");
    expect(shiftDate("2026-03-31", "month", -1)).toBe("2026-02-28");
  });
});

describe("groupTasksByDay", () => {
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString(); // local time

  it("groups by local day and sorts each day by start time", () => {
    const late = { id: "late", scheduledStart: at(17, 15) };
    const early = { id: "early", scheduledStart: at(17, 9, 30) };
    const next = { id: "next", scheduledStart: at(18, 8) };
    const grouped = groupTasksByDay([late, next, early]);
    expect(grouped.get("2026-11-17")).toEqual([early, late]);
    expect(grouped.get("2026-11-18")).toEqual([next]);
  });

  it("ignores unscheduled tasks", () => {
    const grouped = groupTasksByDay([{ id: "a", scheduledStart: null }]);
    expect(grouped.size).toBe(0);
  });
});
