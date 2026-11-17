import { describe, expect, it } from "vitest";
import { nextDeadline } from "./recurrence";

const d = (s: string) => new Date(s + "T00:00:00.000Z");

describe("nextDeadline", () => {
  it("adds days", () => {
    expect(nextDeadline(d("2026-11-17"), 3, "day", null)).toEqual(d("2026-11-20"));
  });

  it("adds weeks", () => {
    expect(nextDeadline(d("2026-11-17"), 2, "week", null)).toEqual(d("2026-12-01"));
  });

  it("adds months", () => {
    expect(nextDeadline(d("2026-11-17"), 1, "month", null)).toEqual(d("2026-12-17"));
  });

  it("clamps to month end instead of overflowing", () => {
    expect(nextDeadline(d("2026-01-31"), 1, "month", null)).toEqual(d("2026-02-28"));
  });

  it("returns the next date when it equals the until date", () => {
    expect(nextDeadline(d("2026-11-17"), 1, "day", d("2026-11-18"))).toEqual(d("2026-11-18"));
  });

  it("returns null when the next date is past the until date", () => {
    expect(nextDeadline(d("2026-11-17"), 1, "day", d("2026-11-17"))).toBeNull();
  });

  it("returns null for a non-positive interval", () => {
    expect(nextDeadline(d("2026-11-17"), 0, "day", null)).toBeNull();
  });
});
