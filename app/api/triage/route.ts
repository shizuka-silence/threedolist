import { NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems } from "@/db/schema";
import { parseEmailBatchToTriageItems } from "@/lib/ai";
import { isTriageRequestAuthorized } from "@/lib/triage-auth";
import { formatEmailBatchForAi, normalizeParsedTriageItems, type EmailInput, type NormalizedTriageItem } from "@/lib/triage-rules";

// POST `{ emails: [{ subject, sender, body }] }` or a single `{ subject, body, rawText }`
// with `Authorization: Bearer <TRIAGE_WEBHOOK_SECRET>`. One AI call sorts the whole batch.
// No session here, so items are filed under TRIAGE_DEFAULT_USER_ID.
export async function POST(request: Request) {
  if (!isTriageRequestAuthorized(request.headers.get("authorization"), process.env.TRIAGE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = process.env.TRIAGE_DEFAULT_USER_ID;
  if (!userId) return NextResponse.json({ error: "TRIAGE_DEFAULT_USER_ID is not set" }, { status: 500 });

  const payload = await request.json().catch(() => null);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const emails: EmailInput[] = Array.isArray(payload?.emails)
    ? payload.emails.map((e: Record<string, unknown>) => ({ subject: str(e?.subject), sender: str(e?.sender), body: str(e?.body) }))
    : [{ subject: str(payload?.subject), sender: str(payload?.sender), body: str(payload?.body) ?? str(payload?.rawText) }];
  if (!emails.some((e) => e.subject?.trim() || e.body?.trim())) {
    return NextResponse.json({ error: "No email content" }, { status: 400 });
  }

  let items: NormalizedTriageItem[];
  try {
    const parsed = await parseEmailBatchToTriageItems(formatEmailBatchForAi(emails));
    items = normalizeParsedTriageItems(parsed.items);
  } catch (error) {
    console.error("Triage AI failed, filing raw emails", error);
    items = [];
  }
  // Fallback so an AI failure (or an empty result) never silently drops mail.
  if (items.length === 0) {
    items = normalizeParsedTriageItems(
      emails.map((e) => ({ category: "requirement", sourceSubject: e.subject || e.body?.slice(0, 80), summary: e.body?.slice(0, 300) })),
    );
  }
  if (items.length === 0) return NextResponse.json({ error: "No email content" }, { status: 400 });

  await db.insert(triageItems).values(items.map((item) => ({ ...item, userId })));
  return NextResponse.json({ ok: true, count: items.length }, { status: 201 });
}
