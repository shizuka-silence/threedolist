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
