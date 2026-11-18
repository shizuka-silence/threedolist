import { describe, expect, it } from "vitest";
import { fromDatetimeLocal, isOverdue, toDatetimeLocal } from "./deadline";

describe("datetime-local conversion", () => {
  it("round-trips an instant at minute precision in the browser's timezone", () => {
    const iso = "2026-11-21T15:59:00.000Z";
    expect(fromDatetimeLocal(toDatetimeLocal(iso))).toBe(iso);
  });

  it("formats as YYYY-MM-DDTHH:mm", () => {
    expect(toDatetimeLocal("2026-11-21T15:59:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("maps empty and invalid input to null / empty", () => {
    expect(fromDatetimeLocal("")).toBeNull();
    expect(fromDatetimeLocal("garbage")).toBeNull();
    expect(toDatetimeLocal(null)).toBe("");
  });
});

describe("isOverdue", () => {
  const now = Date.parse("2026-11-21T12:00:00.000Z");
  it("compares the full timestamp, not just the date", () => {
    expect(isOverdue("2026-11-21T11:59:00.000Z", now)).toBe(true);
    expect(isOverdue("2026-11-21T12:01:00.000Z", now)).toBe(false);
  });
  it("is false without a deadline", () => {
    expect(isOverdue(null, now)).toBe(false);
  });
});
