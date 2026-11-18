import { describe, expect, it } from "vitest";
import {
  MAX_EMAIL_BODY_CHARS,
  MAX_STORED_BODY_CHARS,
  buildPromotionTaskPayload,
  formatEmailBatchForAi,
  normalizeParsedTriageItems,
  parseTriageCategory,
  TRIAGE_CATEGORIES,
} from "./triage-rules";

describe("formatEmailBatchForAi", () => {
  it("combines multiple emails into one block with subject, sender and body", () => {
    const text = formatEmailBatchForAi([
      { subject: "Rent due", sender: "landlord@x.com", body: "Pay by Friday" },
      { subject: "Re: Rent due", sender: "landlord@x.com", body: "Correction: Monday" },
    ]);
    expect(text).toContain("Rent due");
    expect(text).toContain("landlord@x.com");
    expect(text).toContain("Pay by Friday");
    expect(text).toContain("Correction: Monday");
    expect(text.indexOf("Pay by Friday")).toBeLessThan(text.indexOf("Correction: Monday"));
  });

  it("numbers each email so the model can tell them apart", () => {
    const text = formatEmailBatchForAi([{ subject: "A" }, { subject: "B" }]);
    expect(text).toContain("Email 1");
    expect(text).toContain("Email 2");
  });

  it("truncates huge bodies to the cap", () => {
    const text = formatEmailBatchForAi([{ subject: "Big", body: "x".repeat(MAX_EMAIL_BODY_CHARS * 10) }]);
    expect(text.length).toBeLessThan(MAX_EMAIL_BODY_CHARS + 500);
    expect(text).toContain("x".repeat(MAX_EMAIL_BODY_CHARS));
    expect(text).not.toContain("x".repeat(MAX_EMAIL_BODY_CHARS + 1));
  });

  it("tolerates missing fields", () => {
    expect(() => formatEmailBatchForAi([{}])).not.toThrow();
  });
});

describe("normalizeParsedTriageItems", () => {
  it("keeps all four valid categories", () => {
    const items = normalizeParsedTriageItems([
      { category: "announcement", sourceSubject: "A", summary: "s", suggestedAction: "a" },
      { category: "requirement", sourceSubject: "B", summary: "s", suggestedAction: "a" },
      { category: "opportunity", sourceSubject: "C", summary: "s", suggestedAction: "a" },
      { category: "reply", sourceSubject: "D", summary: "s", suggestedAction: "a" },
    ]);
    expect(items.map((i) => i.category)).toEqual(["announcement", "requirement", "opportunity", "reply"]);
  });

  it("falls back to requirement for an unknown category", () => {
    const [item] = normalizeParsedTriageItems([{ category: "spam", sourceSubject: "X" }]);
    expect(item.category).toBe("requirement");
  });

  it("filters out items with empty or whitespace subjects", () => {
    const items = normalizeParsedTriageItems([
      { category: "reply", sourceSubject: "" },
      { category: "reply", sourceSubject: "   " },
      { category: "reply" },
      { category: "reply", sourceSubject: "Keep" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].sourceSubject).toBe("Keep");
  });

  it("trims text and turns blank summary/action into null", () => {
    const [item] = normalizeParsedTriageItems([
      { category: "reply", sourceSubject: "  Hi  ", summary: "  ", suggestedAction: " Reply yes " },
    ]);
    expect(item).toEqual({ category: "reply", sourceSubject: "Hi", summary: null, suggestedAction: "Reply yes" });
  });

  it("returns [] for non-array input", () => {
    expect(normalizeParsedTriageItems(null)).toEqual([]);
    expect(normalizeParsedTriageItems({})).toEqual([]);
  });

  describe("sourceUrl", () => {
    const emails = [{ url: "https://mail.google.com/a" }, { url: "https://mail.google.com/b" }, {}];
    const sourceUrlFor = (emailNumber: unknown, list = emails) =>
      normalizeParsedTriageItems([{ category: "reply", sourceSubject: "X", emailNumber }], list)[0].sourceUrl;

    it("takes the url from the email the AI says the item came from (1-based)", () => {
      expect(sourceUrlFor(2)).toBe("https://mail.google.com/b");
    });

    it("leaves sourceUrl unset when the email has no url, the number is out of range, or it is not a number", () => {
      expect(sourceUrlFor(3)).toBeUndefined();
      expect(sourceUrlFor(0)).toBeUndefined();
      expect(sourceUrlFor(99)).toBeUndefined();
      expect(sourceUrlFor("1")).toBeUndefined();
    });

    it("never accepts a non-http(s) url", () => {
      expect(sourceUrlFor(1, [{ url: "javascript:alert(1)" }])).toBeUndefined();
    });

    it("works without an emails list", () => {
      expect(normalizeParsedTriageItems([{ category: "reply", sourceSubject: "X", emailNumber: 1 }])[0].sourceUrl).toBeUndefined();
    });
  });
});

describe("buildPromotionTaskPayload", () => {
  const base = { sourceSubject: "Quarterly report", summary: "Numbers needed", suggestedAction: "Reply Yes/No to Sam" };

  it("requirement -> proof task titled with the subject", () => {
    const p = buildPromotionTaskPayload({ ...base, category: "requirement" });
    expect(p.title).toBe("Quarterly report");
    expect(p.completionType).toBe("proof");
    expect(p.notes).toContain("Numbers needed");
  });

  it("opportunity -> proof task prefixed with Register / RSVP:", () => {
    const p = buildPromotionTaskPayload({ ...base, category: "opportunity" });
    expect(p.title).toBe("Register / RSVP: Quarterly report");
    expect(p.completionType).toBe("proof");
  });

  it("reply -> tick task titled with the suggested action", () => {
    const p = buildPromotionTaskPayload({ ...base, category: "reply" });
    expect(p.title).toBe("Reply Yes/No to Sam");
    expect(p.completionType).toBe("tick");
  });

  it("reply without a suggested action falls back to Reply: subject", () => {
    const p = buildPromotionTaskPayload({ category: "reply", sourceSubject: "Lunch?", suggestedAction: null });
    expect(p.title).toBe("Reply: Lunch?");
  });

  it("announcement -> tick task titled with the subject", () => {
    const p = buildPromotionTaskPayload({ ...base, category: "announcement" });
    expect(p.title).toBe("Quarterly report");
    expect(p.completionType).toBe("tick");
  });

  it("notes is a string even when summary and action are missing", () => {
    const p = buildPromotionTaskPayload({ category: "requirement", sourceSubject: "S" });
    expect(typeof p.notes).toBe("string");
  });
});

describe("parseTriageCategory", () => {
  it("lists the four categories", () => {
    expect([...TRIAGE_CATEGORIES]).toEqual(["announcement", "requirement", "opportunity", "reply"]);
  });

  it.each(["announcement", "requirement", "opportunity", "reply"])("accepts %s", (category) => {
    expect(parseTriageCategory(category)).toBe(category);
  });

  it.each(["spam", "", "Reply", undefined, null, 3])("throws on %s", (value) => {
    expect(() => parseTriageCategory(value)).toThrow();
  });
});

describe("normalizeParsedTriageItems deadline (UTC+8)", () => {
  const deadlineFor = (extra: Record<string, unknown>) =>
    normalizeParsedTriageItems([{ category: "requirement", sourceSubject: "X", ...extra }])[0].deadline;

  it("combines date and time as UTC+8", () => {
    expect(deadlineFor({ deadlineDate: "2026-11-21", deadlineTime: "17:00" })).toEqual(new Date("2026-11-21T09:00:00.000Z"));
  });

  it("defaults to 11:59 PM UTC+8 when no time is given", () => {
    expect(deadlineFor({ deadlineDate: "2026-11-21" })).toEqual(new Date("2026-11-21T15:59:00.000Z"));
    expect(deadlineFor({ deadlineDate: "2026-11-21", deadlineTime: null })).toEqual(new Date("2026-11-21T15:59:00.000Z"));
  });

  it("treats an invalid time as no time", () => {
    expect(deadlineFor({ deadlineDate: "2026-11-21", deadlineTime: "25:99" })).toEqual(new Date("2026-11-21T15:59:00.000Z"));
  });

  it("leaves the deadline unset without a valid date", () => {
    expect(deadlineFor({})).toBeUndefined();
    expect(deadlineFor({ deadlineDate: null, deadlineTime: "17:00" })).toBeUndefined();
    expect(deadlineFor({ deadlineDate: "next friday" })).toBeUndefined();
    expect(deadlineFor({ deadlineDate: "2026-13-45" })).toBeUndefined();
  });
});

describe("buildPromotionTaskPayload deadline", () => {
  it("carries the triage item's deadline to the task", () => {
    const deadline = new Date("2026-11-21T09:00:00.000Z");
    expect(buildPromotionTaskPayload({ category: "requirement", sourceSubject: "S", deadline }).deadline).toEqual(deadline);
  });

  it("is null when the item has no deadline", () => {
    expect(buildPromotionTaskPayload({ category: "requirement", sourceSubject: "S" }).deadline).toBeNull();
  });
});

describe("normalizeParsedTriageItems sourceBody", () => {
  const emails = [{ body: "  First email text  " }, { body: "Second email text" }, { body: "   " }, {}];
  const bodyFor = (emailNumber: unknown, list: { body?: string }[] | undefined = emails) =>
    normalizeParsedTriageItems([{ category: "reply", sourceSubject: "X", emailNumber }], list)[0].sourceBody;

  it("takes the trimmed body from the email the AI says the item came from (1-based)", () => {
    expect(bodyFor(1)).toBe("First email text");
    expect(bodyFor(2)).toBe("Second email text");
  });

  it("leaves it unset for a blank or missing body, a bad number, or no emails list (pasted dumps)", () => {
    expect(bodyFor(3)).toBeUndefined();
    expect(bodyFor(4)).toBeUndefined();
    expect(bodyFor(0)).toBeUndefined();
    expect(bodyFor(99)).toBeUndefined();
    expect(bodyFor("1")).toBeUndefined();
    // No emails list at all (pasted dump); not bodyFor(1, undefined), which would fall back to the default list.
    expect(normalizeParsedTriageItems([{ category: "reply", sourceSubject: "X", emailNumber: 1 }])[0].sourceBody).toBeUndefined();
  });

  it("stores far more than the AI sees, but still caps it", () => {
    expect(MAX_STORED_BODY_CHARS).toBeGreaterThan(MAX_EMAIL_BODY_CHARS);
    const body = bodyFor(1, [{ body: "x".repeat(MAX_STORED_BODY_CHARS * 2) }]);
    expect(body).toHaveLength(MAX_STORED_BODY_CHARS);
  });
});
