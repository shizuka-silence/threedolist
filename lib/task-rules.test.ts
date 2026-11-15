import { describe, expect, it } from "vitest";
import { assertCanComplete, calculateLoggedMinutes } from "./task-rules";

describe("assertCanComplete (proof-of-work gate)", () => {
  it("throws for a proof task with no proofs", () => {
    expect(() => assertCanComplete({ completionType: "proof" }, [])).toThrow();
  });

  it("succeeds for a proof task with one proof", () => {
    expect(() => assertCanComplete({ completionType: "proof" }, [{}])).not.toThrow();
  });

  it("succeeds for a proof task with several proofs", () => {
    expect(() => assertCanComplete({ completionType: "proof" }, [{}, {}])).not.toThrow();
  });

  it("succeeds for a tick task with no proofs", () => {
    expect(() => assertCanComplete({ completionType: "tick" }, [])).not.toThrow();
  });
});

describe("calculateLoggedMinutes (timer + idle trim)", () => {
  const startedAt = new Date("2026-01-01T10:00:00Z");
  const minutesLater = (m: number) => new Date(startedAt.getTime() + m * 60_000);

  it("returns elapsed whole minutes", () => {
    expect(calculateLoggedMinutes({ startedAt, endedAt: minutesLater(25), trimmedIdleMinutes: 0 })).toBe(25);
  });

  it("subtracts trimmed idle minutes", () => {
    expect(calculateLoggedMinutes({ startedAt, endedAt: minutesLater(25), trimmedIdleMinutes: 10 })).toBe(15);
  });

  it("rounds partial minutes to the nearest minute", () => {
    const endedAt = new Date(startedAt.getTime() + 90_000); // 1.5 min
    expect(calculateLoggedMinutes({ startedAt, endedAt, trimmedIdleMinutes: 0 })).toBe(2);
  });

  it("clamps to 0 when the trim exceeds the elapsed time", () => {
    expect(calculateLoggedMinutes({ startedAt, endedAt: minutesLater(5), trimmedIdleMinutes: 30 })).toBe(0);
  });

  it("clamps to 0 when endedAt is before startedAt", () => {
    expect(calculateLoggedMinutes({ startedAt, endedAt: minutesLater(-5), trimmedIdleMinutes: 0 })).toBe(0);
  });
});
