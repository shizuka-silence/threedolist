export const TRIAGE_CATEGORIES = ["announcement", "requirement", "opportunity", "reply"] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

export type EmailInput = { subject?: string; sender?: string; body?: string; url?: string };

export type NormalizedTriageItem = {
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
  sourceUrl?: string;
  deadline?: Date;
  sourceBody?: string;
};

// shortcut: one timezone (UTC+8, Philippines, no DST) for reading email deadlines; upgrade to a per-user IANA timezone when a second timezone appears.
export const APP_UTC_OFFSET = "+08:00";
const DEFAULT_DEADLINE_TIME = "23:59"; // "due Friday" with no time means the end of that day

/** AI gives date and time separately; a missing or invalid time becomes 11:59 PM. Returns undefined without a real date. */
function parseDeadline(date: unknown, time: unknown): Date | undefined {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const clock = typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_DEADLINE_TIME;
  const deadline = new Date(`${date}T${clock}:00${APP_UTC_OFFSET}`);
  // Round-trip catches overflow: 2026-13-45 is NaN, 2026-02-30 would roll into March.
  const real = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== date ? undefined : deadline;
}

export const MAX_EMAIL_BODY_CHARS = 1500; // what the AI reads
export const MAX_STORED_BODY_CHARS = 5000; // what "Show full email" keeps; it ships with every pending item on page load

export function parseTriageCategory(value: unknown): TriageCategory {
  const category = TRIAGE_CATEGORIES.find((c) => c === value);
  if (!category) throw new Error(`Invalid triage category: ${String(value)}`);
  return category;
}

export function formatEmailBatchForAi(emails: EmailInput[]): string {
  return emails
    .map((e, i) => {
      const body = (e.body ?? "").slice(0, MAX_EMAIL_BODY_CHARS);
      return `--- Email ${i + 1} ---\nFrom: ${e.sender ?? "(unknown)"}
Subject: ${e.subject ?? "(none)"}\n\n${body}`;
    })
    .join("\n\n");
}

// `emails` lets us turn the AI's 1-based `emailNumber` into that email's real url (the AI never writes urls itself).
export function normalizeParsedTriageItems(rawItems: unknown, emails: EmailInput[] = []): NormalizedTriageItem[] {
  if (!Array.isArray(rawItems)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
  const items: NormalizedTriageItem[] = [];
  for (const raw of rawItems) {
    const sourceSubject = text(raw?.sourceSubject);
    if (!sourceSubject) continue;
    const category = TRIAGE_CATEGORIES.includes(raw.category) ? raw.category : "requirement";
    const url = Number.isInteger(raw.emailNumber) ? emails[raw.emailNumber - 1]?.url : undefined;
    const sourceUrl = url && /^https?:\/\//i.test(url) ? url : undefined;
    const sourceBody = Number.isInteger(raw.emailNumber) ? text(emails[raw.emailNumber - 1]?.body)?.slice(0, MAX_STORED_BODY_CHARS) : undefined;
    const deadline = parseDeadline(raw.deadlineDate, raw.deadlineTime);
    items.push({ category, sourceSubject, summary: text(raw.summary), suggestedAction: text(raw.suggestedAction), sourceUrl, sourceBody, deadline });
  }
  return items;
}

export function buildPromotionTaskPayload(item: {
  category: TriageCategory;
  sourceSubject: string;
  summary?: string | null;
  suggestedAction?: string | null;
  deadline?: Date | null;
}): { title: string; completionType: "proof" | "tick"; notes: string; deadline: Date | null } {
  const deadline = item.deadline ?? null;
  const notes = [item.summary, item.suggestedAction && `Suggested: ${item.suggestedAction}`].filter(Boolean).join("\n");
  switch (item.category) {
    case "opportunity":
      return { title: `Register / RSVP: ${item.sourceSubject}`, completionType: "proof", notes, deadline };
    case "reply":
      return { title: item.suggestedAction || `Reply: ${item.sourceSubject}`, completionType: "tick", notes, deadline };
    case "announcement":
      return { title: item.sourceSubject, completionType: "tick", notes, deadline };
    default:
      return { title: item.sourceSubject, completionType: "proof", notes, deadline };
  }
}
