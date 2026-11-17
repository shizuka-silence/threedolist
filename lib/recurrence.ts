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

/** Next date after `base` that falls on one of `weekdays` (0=Sun..6=Sat, UTC), or null if none/past `until`. */
export function nextWeekdayDeadline(base: Date, weekdays: number[], until: Date | null): Date | null {
  if (weekdays.length === 0) return null;
  for (let i = 1; i <= 7; i++) {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + i);
    if (!weekdays.includes(next.getUTCDay())) continue;
    return until && next > until ? null : next;
  }
  return null;
}
