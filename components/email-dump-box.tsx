"use client";

import { useState } from "react";
import { ingestEmailDump, triggerGmailSync } from "@/app/actions/triage";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";

export function EmailDumpBox({ canSyncGmail }: { canSyncGmail: boolean }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const { run } = useDashboard();

  async function sort() {
    setPending(true);
    // Reversed so the first email ends up on top (each upsert lands first).
    const result = await run(null, () => ingestEmailDump(text), (r) =>
      (r.items ?? []).toReversed().map((item) => ({ type: "triage/upsert" as const, item })),
    );
    setPending(false);
    if (!result.error) setText("");
  }

  async function syncGmail() {
    setPending(true);
    await run(null, triggerGmailSync); // new emails appear on the next page load
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Paste Email Dump (AI Sort)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
            rows={6}
            aria-label="Email dump"
            placeholder="Paste one or many emails…"
            className="w-full rounded-md border bg-background p-3 text-base"
          />
          <Button onClick={sort} disabled={pending || !text.trim()} className="h-10">
            {pending ? "Sorting…" : "Sort with AI"}
          </Button>
        </div>
      </details>
      {canSyncGmail && (
        <Button variant="outline" onClick={syncGmail} disabled={pending} className="h-10">
          Sync Gmail
        </Button>
      )}
    </div>
  );
}
