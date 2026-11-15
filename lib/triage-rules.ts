export type TriageCategory = "announcement" | "requirement" | "opportunity" | "reply";

export type EmailInput = { subject?: string; sender?: string; body?: string };

export type NormalizedTriageItem = {
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
};

export const MAX_EMAIL_BODY_CHARS = 1500;

// Red phase: signatures only. Implementations come after the tests are committed.
export function formatEmailBatchForAi(emails: EmailInput[]): string {
  throw new Error("not implemented");
}

export function normalizeParsedTriageItems(rawItems: unknown): NormalizedTriageItem[] {
  throw new Error("not implemented");
}

export function buildPromotionTaskPayload(item: {
  category: TriageCategory;
  sourceSubject: string;
  summary?: string | null;
  suggestedAction?: string | null;
}): { title: string; completionType: "proof" | "tick"; notes: string } {
  throw new Error("not implemented");
}
