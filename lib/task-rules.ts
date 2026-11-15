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

export type AiPrepParts = { estimate: boolean; questions: boolean; pitfalls: boolean };
export type AiPrep = { estimatedMinutes: number | null; pitfalls: string[]; clarifyingQuestions: string[] };

function usableStrings(value: unknown, max: number, what: string): string[] {
  const items = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];
  if (items.length < 2) throw new Error(`AI returned too few ${what}.`);
  return items.slice(0, max);
}

/**
 * Validates raw AI output for the selected parts only (unselected parts come back null / []).
 * Trims/drops blank strings, caps pitfalls at 4 and questions at 3, rounds the estimate to a whole number >= 1.
 * Throws if no part is selected or a selected part has too little usable output.
 */
export function normalizeAiPrepOutput(
  raw: unknown,
  parts: AiPrepParts = { estimate: true, questions: true, pitfalls: true },
): AiPrep {
  if (!parts.estimate && !parts.questions && !parts.pitfalls) throw new Error("Pick at least one thing for AI to provide.");
  const input = (raw ?? {}) as Record<string, unknown>;

  let estimatedMinutes: number | null = null;
  if (parts.estimate) {
    const minutes = input.estimated_minutes;
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("AI returned an invalid estimate.");
    }
    estimatedMinutes = Math.max(1, Math.round(minutes));
  }
  return {
    estimatedMinutes,
    pitfalls: parts.pitfalls ? usableStrings(input.pitfalls, 4, "pitfalls") : [],
    clarifyingQuestions: parts.questions ? usableStrings(input.clarifying_questions, 3, "questions") : [],
  };
}
