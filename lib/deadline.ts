// Deadlines are stored as UTC instants (ISO); the picker and labels show them in the browser's own timezone.

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO -> the `YYYY-MM-DDTHH:mm` value of a datetime-local input, in local time. */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) -> ISO, or null when empty or invalid. */
export function fromDatetimeLocal(value: string): string | null {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

export const isOverdue = (iso: string | null, nowMs: number) => iso !== null && Date.parse(iso) < nowMs;

/** "Nov 21, 11:59 PM" in the browser's timezone. */
export const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
