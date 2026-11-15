/** Proof tasks cannot be completed until at least one proof exists. */
export function assertCanComplete(task: { completionType: "proof" | "tick" }, proofs: unknown[]): void {
  if (task.completionType === "proof" && proofs.length === 0) {
    throw new Error("Add proof before completing this task.");
  }
}

/** Whole minutes worked, after trimming idle time. Never negative. */
export function calculateLoggedMinutes(input: {
  startedAt: Date;
  endedAt: Date;
  trimmedIdleMinutes: number;
}): number {
  const elapsedMinutes = (input.endedAt.getTime() - input.startedAt.getTime()) / 60_000;
  return Math.max(0, Math.round(elapsedMinutes - input.trimmedIdleMinutes));
}

/** AI only fills an empty estimate; any user-entered value (even 0) is kept. */
export function resolveAiEstimate(currentEstimate: number | null, aiEstimate: number): number {
  return currentEstimate ?? aiEstimate;
}

export type AiPrep = { estimatedMinutes: number; pitfalls: string[]; clarifyingQuestions: string[] };

function usableStrings(value: unknown, max: number, what: string): string[] {
  const items = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];
  if (items.length < 2) throw new Error(`AI returned too few ${what}.`);
  return items.slice(0, max);
}

/** Validates raw AI output: trims/drops blank strings, caps pitfalls at 4 and questions at 3, rounds the estimate to a whole number >= 1. Throws if too little usable output. */
export function normalizeAiPrepOutput(raw: unknown): AiPrep {
  const input = (raw ?? {}) as Record<string, unknown>;
  const minutes = input.estimated_minutes;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("AI returned an invalid estimate.");
  }
  return {
    estimatedMinutes: Math.max(1, Math.round(minutes)),
    pitfalls: usableStrings(input.pitfalls, 4, "pitfalls"),
    clarifyingQuestions: usableStrings(input.clarifying_questions, 3, "questions"),
  };
}
