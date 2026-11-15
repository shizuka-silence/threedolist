export const TRIAGE_CATEGORIES = ["announcement", "requirement", "opportunity", "reply"] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

export type EmailInput = { subject?: string; sender?: string; body?: string };

export type NormalizedTriageItem = {
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
};

export const MAX_EMAIL_BODY_CHARS = 1500;

// Red phase: stub accepts everything. Implementation comes after the tests are committed.
export function parseTriageCategory(value: unknown): TriageCategory {
  return value as TriageCategory;
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

export function normalizeParsedTriageItems(rawItems: unknown): NormalizedTriageItem[] {
  if (!Array.isArray(rawItems)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
  const items: NormalizedTriageItem[] = [];
  for (const raw of rawItems) {
    const sourceSubject = text(raw?.sourceSubject);
    if (!sourceSubject) continue;
    const category = TRIAGE_CATEGORIES.includes(raw.category) ? raw.category : "requirement";
    items.push({ category, sourceSubject, summary: text(raw.summary), suggestedAction: text(raw.suggestedAction) });
  }
  return items;
}

export function buildPromotionTaskPayload(item: {
  category: TriageCategory;
  sourceSubject: string;
  summary?: string | null;
  suggestedAction?: string | null;
}): { title: string; completionType: "proof" | "tick"; notes: string } {
  const notes = [item.summary, item.suggestedAction && `Suggested: ${item.suggestedAction}`].filter(Boolean).join("\n");
  switch (item.category) {
    case "opportunity":
      return { title: `Register / RSVP: ${item.sourceSubject}`, completionType: "proof", notes };
    case "reply":
      return { title: item.suggestedAction || `Reply: ${item.sourceSubject}`, completionType: "tick", notes };
    case "announcement":
      return { title: item.sourceSubject, completionType: "tick", notes };
    default:
      return { title: item.sourceSubject, completionType: "proof", notes };
  }
}
