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
  throw new Error("not implemented");
}

export type AiPrep = { estimatedMinutes: number; pitfalls: string[]; clarifyingQuestions: string[] };

/** Validates raw AI output: trims/drops blank strings, caps pitfalls at 4 and questions at 3, rounds the estimate to a whole number >= 1. Throws if too little usable output. */
export function normalizeAiPrepOutput(raw: unknown): AiPrep {
  throw new Error("not implemented");
}
