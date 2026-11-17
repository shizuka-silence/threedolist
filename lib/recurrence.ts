export type RepeatUnit = "day" | "week" | "month";

/** Next deadline after `base`, or null if the interval is invalid or past `until`. */
export function nextDeadline(
  base: Date,
  every: number,
  unit: RepeatUnit,
  until: Date | null,
): Date | null {
  if (!Number.isInteger(every) || every < 1) return null;
  const next = new Date(base);
  if (unit === "month") {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + every);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  } else {
    next.setUTCDate(next.getUTCDate() + every * (unit === "week" ? 7 : 1));
  }
  return until && next > until ? null : next;
}
