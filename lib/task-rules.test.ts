import { describe, expect, it } from "vitest";
import { assertCanComplete, calculateLoggedMinutes, normalizeAiPrepOutput, resolveAiEstimate } from "./task-rules";

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

describe("resolveAiEstimate (never overwrite a manual estimate)", () => {
  it("adopts the AI estimate when the current estimate is null", () => {
    expect(resolveAiEstimate(null, 30)).toBe(30);
  });

  it("keeps a manual estimate when AI suggests a different one", () => {
    expect(resolveAiEstimate(45, 30)).toBe(45);
  });

  it("keeps a manual estimate of 0", () => {
    expect(resolveAiEstimate(0, 30)).toBe(0);
  });
});

describe("normalizeAiPrepOutput (bounds AI output)", () => {
  const valid = {
    estimated_minutes: 25,
    pitfalls: ["Forgot to attach file", "Wrong recipient"],
    clarifying_questions: ["Who is this for?", "What is the deadline?"],
  };

  it("maps a valid payload to camelCase fields", () => {
    expect(normalizeAiPrepOutput(valid)).toEqual({
      estimatedMinutes: 25,
      pitfalls: valid.pitfalls,
      clarifyingQuestions: valid.clarifying_questions,
    });
  });

  it("keeps only the first 4 pitfalls", () => {
    const out = normalizeAiPrepOutput({ ...valid, pitfalls: ["a", "b", "c", "d", "e", "f"] });
    expect(out.pitfalls).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps only the first 3 clarifying questions", () => {
    const out = normalizeAiPrepOutput({ ...valid, clarifying_questions: ["a?", "b?", "c?", "d?"] });
    expect(out.clarifyingQuestions).toEqual(["a?", "b?", "c?"]);
  });

  it("trims strings and drops blank ones before counting", () => {
    const out = normalizeAiPrepOutput({ ...valid, pitfalls: ["  a  ", "", "   ", "b"] });
    expect(out.pitfalls).toEqual(["a", "b"]);
  });

  it("throws when fewer than 2 usable pitfalls remain", () => {
    expect(() => normalizeAiPrepOutput({ ...valid, pitfalls: ["a", " "] })).toThrow();
  });

  it("throws when fewer than 2 usable clarifying questions remain", () => {
    expect(() => normalizeAiPrepOutput({ ...valid, clarifying_questions: ["only one?"] })).toThrow();
  });

  it("rounds a fractional estimate to a whole number", () => {
    expect(normalizeAiPrepOutput({ ...valid, estimated_minutes: 12.6 }).estimatedMinutes).toBe(13);
  });

  it("raises a tiny positive estimate to 1", () => {
    expect(normalizeAiPrepOutput({ ...valid, estimated_minutes: 0.2 }).estimatedMinutes).toBe(1);
  });

  it("throws for a zero, negative or non-numeric estimate", () => {
    expect(() => normalizeAiPrepOutput({ ...valid, estimated_minutes: 0 })).toThrow();
    expect(() => normalizeAiPrepOutput({ ...valid, estimated_minutes: -5 })).toThrow();
    expect(() => normalizeAiPrepOutput({ ...valid, estimated_minutes: "20" })).toThrow();
  });

  it("throws for non-object input", () => {
    expect(() => normalizeAiPrepOutput(null)).toThrow();
    expect(() => normalizeAiPrepOutput("nope")).toThrow();
  });
});

describe("normalizeAiPrepOutput with selected parts", () => {
  const raw = {
    estimated_minutes: 25,
    pitfalls: ["Forgot to attach file", "Wrong recipient"],
    clarifying_questions: ["Who is this for?", "What is the deadline?"],
  };
  const none = { estimate: false, questions: false, pitfalls: false };

  it("returns only the estimate when only estimate is selected", () => {
    expect(normalizeAiPrepOutput(raw, { ...none, estimate: true })).toEqual({
      estimatedMinutes: 25,
      pitfalls: [],
      clarifyingQuestions: [],
    });
  });

  it("returns only pitfalls when only pitfalls are selected", () => {
    expect(normalizeAiPrepOutput(raw, { ...none, pitfalls: true })).toEqual({
      estimatedMinutes: null,
      pitfalls: raw.pitfalls,
      clarifyingQuestions: [],
    });
  });

  it("returns only questions when only questions are selected", () => {
    expect(normalizeAiPrepOutput(raw, { ...none, questions: true })).toEqual({
      estimatedMinutes: null,
      pitfalls: [],
      clarifyingQuestions: raw.clarifying_questions,
    });
  });

  it("ignores garbage in parts that were not selected", () => {
    const messy = { estimated_minutes: "soon", pitfalls: ["a", "b"], clarifying_questions: null };
    expect(normalizeAiPrepOutput(messy, { ...none, pitfalls: true })).toEqual({
      estimatedMinutes: null,
      pitfalls: ["a", "b"],
      clarifyingQuestions: [],
    });
  });

  it("still validates a selected part", () => {
    expect(() => normalizeAiPrepOutput({ ...raw, pitfalls: ["only one"] }, { ...none, pitfalls: true })).toThrow();
  });

  it("throws when no part is selected", () => {
    expect(() => normalizeAiPrepOutput(raw, none)).toThrow();
  });
});
