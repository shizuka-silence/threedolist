import { NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems } from "@/db/schema";
import { isTriageRequestAuthorized } from "@/lib/triage-auth";

// POST { "sourceSubject": "...", "summary"?: "...", "suggestedAction"?: "..." } with `Authorization: Bearer <TRIAGE_WEBHOOK_SECRET>`.
// No session here, so items are filed under TRIAGE_DEFAULT_USER_ID.
export async function POST(request: Request) {
  if (!isTriageRequestAuthorized(request.headers.get("authorization"), process.env.TRIAGE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = process.env.TRIAGE_DEFAULT_USER_ID;
  if (!userId) return NextResponse.json({ error: "TRIAGE_DEFAULT_USER_ID is not set" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const text = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);
  const sourceSubject = text(body?.sourceSubject);
  if (!sourceSubject) return NextResponse.json({ error: "sourceSubject is required" }, { status: 400 });

  await db.insert(triageItems).values({
    userId,
    sourceSubject,
    summary: text(body.summary),
    suggestedAction: text(body.suggestedAction),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
