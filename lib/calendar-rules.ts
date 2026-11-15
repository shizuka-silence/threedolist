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
