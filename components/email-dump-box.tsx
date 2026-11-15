"use client";

import { useState, useTransition } from "react";
import { ingestEmailDump, triggerGmailSync } from "@/app/actions/triage";
import { Button } from "@/components/ui/button";

export function EmailDumpBox({ canSyncGmail }: { canSyncGmail: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) onOk?.();
    });
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
          <Button onClick={() => run(() => ingestEmailDump(text), () => setText(""))} disabled={pending || !text.trim()} className="h-10">
            {pending ? "Sorting…" : "Sort with AI"}
          </Button>
        </div>
      </details>
      {canSyncGmail && (
        <Button variant="outline" onClick={() => run(triggerGmailSync)} disabled={pending} className="h-10">
          Sync Gmail
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
