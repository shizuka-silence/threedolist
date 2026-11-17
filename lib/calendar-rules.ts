const DEFAULT_ESTIMATE_MINUTES = 30;

export function computeBlockHeightPx(estimatedMinutes: number | null, pixelsPerHour = 64): number {
  const minutes = estimatedMinutes || DEFAULT_ESTIMATE_MINUTES;
  return (minutes / 60) * pixelsPerHour;
}

export function formatVarianceBadge(estimatedMinutes: number | null, actualMinutes: number): string {
  return `Est: ${estimatedMinutes ?? "--"}${estimatedMinutes === null ? "" : "m"} | Actual: ${actualMinutes}m`;
}

// Local time on purpose: the user picks "2pm" on their own clock.
export function buildSlotTimestamp(dayDateStr: string, hour: number, minute: number): Date {
  const [y, m, d] = dayDateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d, hour, minute, 0, 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayDateStr) || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid day: ${dayDateStr}`);
  }
  return date;
}

// Days are local "YYYY-MM-DD" strings, matching buildSlotTimestamp.
export function toDayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m: m - 1, d };
};

/** The Sunday-to-Saturday week containing `day`. */
export function weekDays(day: string): string[] {
  const { y, m, d } = parseDay(day);
  const sunday = d - new Date(y, m, d).getDay();
  return Array.from({ length: 7 }, (_, i) => toDayStr(new Date(y, m, sunday + i)));
}

/** Whole Sunday-to-Saturday weeks covering the month of `day`, including neighbouring-month days. */
export function monthGrid(day: string): string[] {
  const { y, m } = parseDay(day);
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const start = 1 - first.getDay();
  const end = last.getDate() + (6 - last.getDay());
  return Array.from({ length: end - start + 1 }, (_, i) => toDayStr(new Date(y, m, start + i)));
}

/** Month moves keep the day-of-month, clamped to the target month's length (Jan 31 + 1 month = Feb 28). */
export function shiftDate(day: string, unit: "day" | "week" | "month", delta: number): string {
  const { y, m, d } = parseDay(day);
  if (unit === "month") {
    const lastDay = new Date(y, m + delta + 1, 0).getDate();
    return toDayStr(new Date(y, m + delta, Math.min(d, lastDay)));
  }
  return toDayStr(new Date(y, m, d + (unit === "week" ? 7 : 1) * delta));
}

/** Scheduled tasks grouped by local day, each day sorted by start time. Unscheduled tasks are skipped. */
export function groupTasksByDay<T extends { scheduledStart: string | null }>(tasks: T[]): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  const scheduled = tasks.filter((t) => t.scheduledStart).sort((a, b) => +new Date(a.scheduledStart!) - +new Date(b.scheduledStart!));
  for (const t of scheduled) {
    const key = toDayStr(new Date(t.scheduledStart!));
    byDay.set(key, [...(byDay.get(key) ?? []), t]);
  }
  return byDay;
}
