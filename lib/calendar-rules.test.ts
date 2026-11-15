import { describe, expect, it } from "vitest";
import { buildSlotTimestamp, computeBlockHeightPx, formatVarianceBadge } from "./calendar-rules";

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
